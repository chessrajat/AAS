from pathlib import Path

import shutil
import socket
import random

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from ultralytics import YOLO

from annotate.models import AIModel

from .models import (
    TrainingArtifact,
    TrainingDatasetItem,
    TrainingEpochMetric,
    TrainingJob,
)


class TrainingRunnerError(Exception):
    pass


def _as_json_safe(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _as_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_as_json_safe(item) for item in value]
    if hasattr(value, 'item'):
        try:
            return value.item()
        except Exception:
            pass
    return str(value)


def _copy_file(source_path, destination_path):
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)


def _resolve_base_model(base_model):
    if str(base_model).startswith('ai_model:'):
        model_id = str(base_model).split(':', 1)[1]
        ai_model = AIModel.objects.get(id=model_id)
        return ai_model.file.path
    return base_model


def claim_next_training_job(worker_id=None, job_id=None):
    worker_id = worker_id or f'{socket.gethostname()}'
    with transaction.atomic():
        queryset = TrainingJob.objects.select_for_update().filter(
            status=TrainingJob.STATUS_PENDING,
        )
        if job_id is not None:
            queryset = queryset.filter(id=job_id)
        job = queryset.order_by('queued_at').first()
        if not job:
            return None

        job.status = TrainingJob.STATUS_RUNNING
        job.started_at = timezone.now()
        job.locked_at = timezone.now()
        job.worker_id = worker_id
        job.error_message = ''
        job.save(update_fields=[
            'status',
            'started_at',
            'locked_at',
            'worker_id',
            'error_message',
        ])
        return job


def _write_data_yaml(job, dataset_dir):
    classes = list(job.pipeline.classes.all().order_by('index'))
    if not classes:
        raise TrainingRunnerError('Training pipeline has no classes.')

    names = '\n'.join(f'  {training_class.index}: {training_class.name}' for training_class in classes)
    yaml_content = (
        f'path: {dataset_dir}\n'
        'train: images/train\n'
        'val: images/val\n'
        'test: images/test\n'
        'names:\n'
        f'{names}\n'
    )
    data_yaml_path = dataset_dir / 'data.yaml'
    data_yaml_path.write_text(yaml_content, encoding='utf-8')
    return data_yaml_path


def materialize_yolo_dataset(job):
    if job.dataset_id:
        return materialize_reusable_yolo_dataset(job)

    items = list(job.pipeline.items.all().order_by('id'))
    if not items:
        raise TrainingRunnerError('Training pipeline has no uploaded dataset items.')
    if any(item.split == TrainingDatasetItem.SPLIT_UNASSIGNED for item in items):
        raise TrainingRunnerError('Training dataset still has unassigned items. Apply split first.')

    split_counts = {
        TrainingDatasetItem.SPLIT_TRAIN: 0,
        TrainingDatasetItem.SPLIT_VAL: 0,
        TrainingDatasetItem.SPLIT_TEST: 0,
    }
    dataset_dir = Path(settings.MEDIA_ROOT) / 'training' / 'jobs' / str(job.id) / 'dataset'
    if dataset_dir.exists():
        shutil.rmtree(dataset_dir)

    for split in split_counts:
        (dataset_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (dataset_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)

    for item in items:
        if item.split not in split_counts:
            continue
        if not item.image or not Path(item.image.path).exists():
            raise TrainingRunnerError(f'Missing image file for dataset item {item.id}.')

        image_suffix = Path(item.original_image_name or item.image.name).suffix or Path(item.image.name).suffix
        image_name = f'item-{item.id}{image_suffix}'
        label_name = f'item-{item.id}.txt'
        _copy_file(Path(item.image.path), dataset_dir / 'images' / item.split / image_name)
        if item.label and Path(item.label.path).exists():
            _copy_file(Path(item.label.path), dataset_dir / 'labels' / item.split / label_name)
        else:
            (dataset_dir / 'labels' / item.split / label_name).write_text('', encoding='utf-8')
        split_counts[item.split] += 1

    if split_counts[TrainingDatasetItem.SPLIT_TRAIN] == 0:
        raise TrainingRunnerError('Training split has no train images.')
    if split_counts[TrainingDatasetItem.SPLIT_VAL] == 0:
        raise TrainingRunnerError('Training split has no validation images.')

    data_yaml_path = _write_data_yaml(job, dataset_dir)
    job.dataset_yaml_path = str(data_yaml_path)
    job.save(update_fields=['dataset_yaml_path'])
    return dataset_dir, data_yaml_path


def materialize_reusable_yolo_dataset(job):
    assets = list(job.dataset.assets.all().order_by('id'))
    if not assets:
        raise TrainingRunnerError('Selected training dataset has no files.')

    split_config = getattr(job.pipeline, 'split_config', None)
    train_percent = getattr(split_config, 'train_percent', 80)
    val_percent = getattr(split_config, 'val_percent', 10)
    seed = getattr(split_config, 'seed', 42)

    rng = random.Random(seed)
    rng.shuffle(assets)
    total = len(assets)
    train_count = int(total * train_percent / 100)
    val_count = int(total * val_percent / 100)
    if train_count == 0:
        raise TrainingRunnerError('Training split has no train images.')
    if val_count == 0:
        raise TrainingRunnerError('Training split has no validation images.')

    dataset_dir = Path(settings.MEDIA_ROOT) / 'training' / 'jobs' / str(job.id) / 'dataset'
    if dataset_dir.exists():
        shutil.rmtree(dataset_dir)

    split_counts = {
        TrainingDatasetItem.SPLIT_TRAIN: 0,
        TrainingDatasetItem.SPLIT_VAL: 0,
        TrainingDatasetItem.SPLIT_TEST: 0,
    }
    for split in split_counts:
        (dataset_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (dataset_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)

    for index, asset in enumerate(assets):
        if index < train_count:
            split = TrainingDatasetItem.SPLIT_TRAIN
        elif index < train_count + val_count:
            split = TrainingDatasetItem.SPLIT_VAL
        else:
            split = TrainingDatasetItem.SPLIT_TEST

        if not asset.image or not Path(asset.image.path).exists():
            raise TrainingRunnerError(f'Missing image file for dataset asset {asset.id}.')
        if not asset.label or not Path(asset.label.path).exists():
            raise TrainingRunnerError(f'Missing label file for dataset asset {asset.id}.')

        image_suffix = Path(asset.original_image_name or asset.image.name).suffix or Path(asset.image.name).suffix
        image_name = f'asset-{asset.id}{image_suffix}'
        label_name = f'asset-{asset.id}.txt'
        _copy_file(Path(asset.image.path), dataset_dir / 'images' / split / image_name)
        _copy_file(Path(asset.label.path), dataset_dir / 'labels' / split / label_name)
        split_counts[split] += 1

    data_yaml_path = _write_data_yaml(job, dataset_dir)
    job.dataset_yaml_path = str(data_yaml_path)
    job.save(update_fields=['dataset_yaml_path'])
    return dataset_dir, data_yaml_path


def _save_epoch_metrics(job, trainer):
    epoch = int(getattr(trainer, 'epoch', 0) or 0) + 1
    total_epochs = int(getattr(trainer, 'epochs', 0) or job.total_epochs or 0)
    metrics = _as_json_safe(getattr(trainer, 'metrics', {}) or {})
    TrainingEpochMetric.objects.update_or_create(
        job=job,
        epoch=epoch,
        defaults={'metrics': metrics},
    )
    job.current_epoch = epoch
    job.total_epochs = total_epochs
    job.progress_percent = (epoch / total_epochs * 100) if total_epochs else 0
    job.save(update_fields=['current_epoch', 'total_epochs', 'progress_percent'])


def _store_artifact(job, artifact_type, source_path):
    source = Path(source_path)
    if not source.exists() or not source.is_file():
        return None

    artifact_dir = Path(settings.MEDIA_ROOT) / 'training' / 'jobs' / str(job.id) / 'artifacts'
    artifact_dir.mkdir(parents=True, exist_ok=True)
    destination = artifact_dir / source.name
    if source.resolve() != destination.resolve():
        shutil.copy2(source, destination)

    relative_name = str(destination.relative_to(settings.MEDIA_ROOT))
    artifact, _ = TrainingArtifact.objects.update_or_create(
        job=job,
        artifact_type=artifact_type,
        defaults={
            'file': relative_name,
            'metadata': {'source_path': str(source)},
        },
    )
    return artifact


def _store_training_artifacts(job, run_dir):
    run_path = Path(run_dir)
    _store_artifact(job, TrainingArtifact.TYPE_BEST_MODEL, run_path / 'weights' / 'best.pt')
    _store_artifact(job, TrainingArtifact.TYPE_LAST_MODEL, run_path / 'weights' / 'last.pt')
    _store_artifact(job, TrainingArtifact.TYPE_RESULTS, run_path / 'results.csv')
    _store_artifact(job, TrainingArtifact.TYPE_CONFUSION_MATRIX, run_path / 'confusion_matrix.png')
    _store_artifact(job, TrainingArtifact.TYPE_LOG, run_path / 'args.yaml')


def run_training_job(job):
    job = TrainingJob.objects.select_related('pipeline', 'config', 'dataset').get(id=job.id)
    try:
        dataset_dir, data_yaml_path = materialize_yolo_dataset(job)
        config_args = dict(job.config.args or {})
        total_epochs = int(config_args.get('epochs') or job.total_epochs or 100)
        config_args['epochs'] = total_epochs
        final_args = {
            'data': str(data_yaml_path),
            'project': str(Path(settings.MEDIA_ROOT) / 'training' / 'runs'),
            'name': f'job-{job.id}',
            'exist_ok': True,
            **config_args,
        }
        job.total_epochs = total_epochs
        job.final_args = {
            'model': job.config.base_model,
            **final_args,
        }
        job.save(update_fields=['total_epochs', 'final_args'])

        model = YOLO(_resolve_base_model(job.config.base_model))
        model.add_callback('on_fit_epoch_end', lambda trainer: _save_epoch_metrics(job, trainer))
        result = model.train(**final_args)
        trainer = getattr(model, 'trainer', None)
        save_dir = getattr(trainer, 'save_dir', None) or getattr(result, 'save_dir', None)
        if save_dir:
            job.run_dir = str(save_dir)
            _store_training_artifacts(job, save_dir)

        job.status = TrainingJob.STATUS_COMPLETED
        job.finished_at = timezone.now()
        job.current_epoch = job.total_epochs
        job.progress_percent = 100
        job.save(update_fields=[
            'status',
            'finished_at',
            'current_epoch',
            'progress_percent',
            'run_dir',
        ])
        return job
    except Exception as exc:
        job.status = TrainingJob.STATUS_FAILED
        job.finished_at = timezone.now()
        job.error_message = str(exc)
        job.save(update_fields=['status', 'finished_at', 'error_message'])
        raise
