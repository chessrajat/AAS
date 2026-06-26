import socket
import os
import shutil
import tempfile
import zipfile
from datetime import timedelta

from django.core.files import File
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .annotate import run_auto_annotation
from .models import AutoAnnotateJob, ExportJob


def claim_next_auto_annotate_job(worker_id=None):
    worker_id = worker_id or f'{socket.gethostname()}'
    with transaction.atomic():
        job = (
            AutoAnnotateJob.objects.select_for_update()
            .filter(status=AutoAnnotateJob.STATUS_PENDING)
            .order_by('queued_at')
            .first()
        )
        if not job:
            return None

        job.status = AutoAnnotateJob.STATUS_RUNNING
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


def recover_stale_auto_annotate_jobs(stale_after_seconds=None):
    stale_after_seconds = stale_after_seconds or settings.JOB_STALE_AFTER_SECONDS
    cutoff = timezone.now() - timedelta(seconds=stale_after_seconds)
    return AutoAnnotateJob.objects.filter(
        status=AutoAnnotateJob.STATUS_RUNNING,
    ).filter(
        Q(locked_at__lt=cutoff) | Q(locked_at__isnull=True),
    ).update(
        status=AutoAnnotateJob.STATUS_FAILED,
        finished_at=timezone.now(),
        error_message='Worker heartbeat expired before completing this auto-annotate job.',
    )


def run_auto_annotate_job(auto_annotate_job):
    auto_annotate_job = AutoAnnotateJob.objects.select_related(
        'job',
        'job__project',
        'config',
        'config__model',
    ).get(id=auto_annotate_job.id)
    try:
        def update_progress(processed_images, total_images, annotations_created):
            auto_annotate_job.total_images = total_images
            auto_annotate_job.processed_images = processed_images
            auto_annotate_job.annotations_created = annotations_created
            auto_annotate_job.progress_percent = (
                processed_images / total_images * 100
            ) if total_images else 0
            auto_annotate_job.locked_at = timezone.now()
            auto_annotate_job.save(update_fields=[
                'total_images',
                'processed_images',
                'annotations_created',
                'progress_percent',
                'locked_at',
            ])

        result = run_auto_annotation(
            auto_annotate_job.job,
            auto_annotate_job.config,
            mode=auto_annotate_job.mode,
            progress_callback=update_progress,
        )
        processed_images = int(result.get('images_processed') or 0)
        annotations_created = int(result.get('annotations_created') or 0)
        total_images = auto_annotate_job.total_images or auto_annotate_job.job.images.count()

        auto_annotate_job.status = AutoAnnotateJob.STATUS_COMPLETED
        auto_annotate_job.finished_at = timezone.now()
        auto_annotate_job.total_images = total_images
        auto_annotate_job.processed_images = processed_images
        auto_annotate_job.annotations_created = annotations_created
        auto_annotate_job.progress_percent = 100
        auto_annotate_job.save(update_fields=[
            'status',
            'finished_at',
            'total_images',
            'processed_images',
            'annotations_created',
            'progress_percent',
        ])
        return auto_annotate_job
    except Exception as exc:
        auto_annotate_job.status = AutoAnnotateJob.STATUS_FAILED
        auto_annotate_job.finished_at = timezone.now()
        auto_annotate_job.error_message = str(exc)
        auto_annotate_job.save(update_fields=['status', 'finished_at', 'error_message'])
        raise


def run_next_auto_annotate_job(worker_id=None):
    auto_annotate_job = claim_next_auto_annotate_job(worker_id=worker_id)
    if not auto_annotate_job:
        return False
    run_auto_annotate_job(auto_annotate_job)
    return True


def claim_next_export_job(worker_id=None):
    worker_id = worker_id or f'{socket.gethostname()}'
    with transaction.atomic():
        job = (
            ExportJob.objects.select_for_update()
            .filter(status=ExportJob.STATUS_PENDING)
            .order_by('queued_at')
            .first()
        )
        if not job:
            return None

        job.status = ExportJob.STATUS_RUNNING
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


def recover_stale_export_jobs(stale_after_seconds=None):
    stale_after_seconds = stale_after_seconds or settings.JOB_STALE_AFTER_SECONDS
    cutoff = timezone.now() - timedelta(seconds=stale_after_seconds)
    return ExportJob.objects.filter(
        status=ExportJob.STATUS_RUNNING,
    ).filter(
        Q(locked_at__lt=cutoff) | Q(locked_at__isnull=True),
    ).update(
        status=ExportJob.STATUS_FAILED,
        finished_at=timezone.now(),
        error_message='Worker heartbeat expired before completing this export job.',
    )


def _write_file_to_archive(archive, archive_name, field_file):
    with field_file.open('rb') as source:
        with archive.open(archive_name, 'w') as destination:
            shutil.copyfileobj(source, destination, length=1024 * 1024)


def _write_yolo_export_archive(export_job, archive_path, progress_callback=None):
    job = export_job.job
    project = job.project
    classes = list(project.classes.all().order_by('index'))
    images = (
        job.images
        .prefetch_related('annotations', 'annotations__project_class')
        .order_by('id')
    )
    total_images = export_job.total_images or images.count()

    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_STORED) as archive:
        data_yaml = "path: .\ntrain: images\nval: images\nnames:\n"
        for label in classes:
            data_yaml += f"  - {label.name}\n"
        archive.writestr('data.yaml', data_yaml)

        processed_images = 0
        for image in images.iterator(chunk_size=50):
            if image.file:
                image_name = os.path.join('images', os.path.basename(image.file.name))
                _write_file_to_archive(archive, image_name, image.file)

            label_lines = []
            for annotation in image.annotations.all():
                if image.width == 0 or image.height == 0:
                    continue
                class_index = annotation.project_class.index
                x_center = (annotation.x_min + annotation.x_max) / 2 / image.width
                y_center = (annotation.y_min + annotation.y_max) / 2 / image.height
                box_w = (annotation.x_max - annotation.x_min) / image.width
                box_h = (annotation.y_max - annotation.y_min) / image.height
                label_lines.append(
                    f"{class_index} {x_center:.6f} {y_center:.6f} {box_w:.6f} {box_h:.6f}"
                )

            label_name = os.path.splitext(os.path.basename(image.file.name))[0] + '.txt'
            archive.writestr(os.path.join('labels', label_name), "\n".join(label_lines))

            processed_images += 1
            if progress_callback:
                progress_callback(processed_images, total_images)

    return total_images


def run_export_job(export_job):
    export_job = ExportJob.objects.select_related('job', 'job__project').get(id=export_job.id)
    try:
        def update_progress(processed_images, total_images):
            export_job.total_images = total_images
            export_job.processed_images = processed_images
            export_job.progress_percent = (
                processed_images / total_images * 100
            ) if total_images else 0
            export_job.locked_at = timezone.now()
            export_job.save(update_fields=[
                'total_images',
                'processed_images',
                'progress_percent',
                'locked_at',
            ])

        with tempfile.TemporaryDirectory(prefix='aas-export-') as temp_dir:
            archive_path = os.path.join(temp_dir, f'job-{export_job.job_id}-yolov8.zip')
            total_images = _write_yolo_export_archive(
                export_job,
                archive_path,
                progress_callback=update_progress,
            )
            if export_job.file:
                export_job.file.delete(save=False)
            with open(archive_path, 'rb') as archive_file:
                export_job.file.save(
                    f'job-{export_job.job_id}-yolov8.zip',
                    File(archive_file),
                    save=False,
                )

        export_job.status = ExportJob.STATUS_COMPLETED
        export_job.finished_at = timezone.now()
        export_job.total_images = total_images
        export_job.processed_images = total_images
        export_job.progress_percent = 100
        export_job.save(update_fields=[
            'status',
            'finished_at',
            'total_images',
            'processed_images',
            'progress_percent',
            'file',
        ])
        return export_job
    except Exception as exc:
        export_job.status = ExportJob.STATUS_FAILED
        export_job.finished_at = timezone.now()
        export_job.error_message = str(exc)
        export_job.save(update_fields=['status', 'finished_at', 'error_message'])
        raise


def run_next_export_job(worker_id=None):
    export_job = claim_next_export_job(worker_id=worker_id)
    if not export_job:
        return False
    run_export_job(export_job)
    return True
