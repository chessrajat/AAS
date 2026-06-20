import shutil
import tempfile
from pathlib import Path

from django.conf import settings
from ultralytics import YOLO

from .models import Annotation, AutoAnnotateConfig, Image


class AutoAnnotateError(Exception):
    pass


def _copy_field_file(field_file, destination_path):
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    source = field_file.open('rb')
    try:
        with destination_path.open('wb') as destination:
            if hasattr(source, 'chunks'):
                for chunk in source.chunks():
                    destination.write(chunk)
            else:
                shutil.copyfileobj(source, destination)
    finally:
        if hasattr(source, 'close'):
            source.close()


def _materialize_field_file(field_file, directory, prefix):
    suffix = Path(field_file.name or '').suffix
    destination = Path(directory) / f'{prefix}{suffix}'
    _copy_field_file(field_file, destination)
    return destination


def get_auto_annotate_config(project, model_id=None):
    configs = AutoAnnotateConfig.objects.select_related('model').filter(project=project)
    if model_id is not None:
        config = configs.filter(model_id=model_id).first()
        if not config:
            raise AutoAnnotateError("Auto-annotate config not found for this model.")
        return config

    config = configs.filter(is_active=True).order_by('id').first()
    if not config:
        raise AutoAnnotateError("Auto-annotate config not found for this project.")
    return config


def run_auto_annotation(job, config, progress_callback=None):
    if not config.model.file:
        raise AutoAnnotateError("Model file is missing.")

    mappings = {
        mapping.model_class: mapping.project_class
        for mapping in config.mappings.select_related('project_class').all()
    }
    if not mappings:
        raise AutoAnnotateError("No class mappings configured.")

    images = list(job.images.all().order_by('id'))
    if not images:
        raise AutoAnnotateError("No images available for this job.")

    with tempfile.TemporaryDirectory(prefix='aas-auto-annotate-') as temp_dir:
        try:
            model_path = _materialize_field_file(config.model.file, temp_dir, 'model')
        except FileNotFoundError:
            raise AutoAnnotateError("Model file is missing.")

        yolo = YOLO(str(model_path))
        processed_images = 0
        total_annotations = 0
        total_images = len(images)
        for image in images:
            if not image.file:
                continue

            try:
                image_path = _materialize_field_file(image.file, temp_dir, f'image-{image.id}')
            except FileNotFoundError:
                continue

            predict_args = {
                'source': str(image_path),
                'verbose': False,
            }
            if settings.YOLO_DEVICE:
                predict_args['device'] = settings.YOLO_DEVICE
            results = yolo.predict(**predict_args)
            if not results:
                processed_images += 1
                if progress_callback:
                    progress_callback(processed_images, total_images, total_annotations)
                continue

            result = results[0]
            boxes = result.boxes
            Annotation.objects.filter(image=image).delete()
            if image.status != Image.STATUS_IN_PROGRESS:
                image.status = Image.STATUS_IN_PROGRESS
                image.save(update_fields=['status'])

            if boxes is None or boxes.cls is None or boxes.xyxy is None:
                processed_images += 1
                if progress_callback:
                    progress_callback(processed_images, total_images, total_annotations)
                continue

            new_annotations = []
            for cls_id, coords in zip(boxes.cls.tolist(), boxes.xyxy.tolist()):
                class_index = int(cls_id)
                project_class = mappings.get(class_index)
                if not project_class:
                    continue

                x_min, y_min, x_max, y_max = coords
                x_min = max(0, int(round(x_min)))
                y_min = max(0, int(round(y_min)))
                x_max = min(image.width, int(round(x_max)))
                y_max = min(image.height, int(round(y_max)))
                if x_max <= x_min or y_max <= y_min:
                    continue

                new_annotations.append(
                    Annotation(
                        image=image,
                        project_class=project_class,
                        x_min=x_min,
                        y_min=y_min,
                        x_max=x_max,
                        y_max=y_max,
                    )
                )

            if new_annotations:
                Annotation.objects.bulk_create(new_annotations)
                total_annotations += len(new_annotations)
            processed_images += 1
            if progress_callback:
                progress_callback(processed_images, total_images, total_annotations)

        return {
            "images_processed": processed_images,
            "annotations_created": total_annotations,
        }
