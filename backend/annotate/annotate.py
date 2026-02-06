import os

from ultralytics import YOLO

from .models import Annotation, AutoAnnotateConfig


class AutoAnnotateError(Exception):
    pass


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


def run_auto_annotation(project, config):
    model_path = getattr(config.model.file, 'path', None)
    if not model_path or not os.path.exists(model_path):
        raise AutoAnnotateError("Model file is missing.")

    mappings = {
        mapping.model_class: mapping.project_class
        for mapping in config.mappings.select_related('project_class').all()
    }
    if not mappings:
        raise AutoAnnotateError("No class mappings configured.")

    images = list(project.images.all().order_by('id'))
    if not images:
        raise AutoAnnotateError("No images available for this project.")

    yolo = YOLO(model_path)
    total_images = 0
    total_annotations = 0

    for image in images:
        if not image.file or not os.path.exists(image.file.path):
            continue

        results = yolo.predict(source=image.file.path, verbose=False)
        if not results:
            continue

        result = results[0]
        boxes = result.boxes
        Annotation.objects.filter(image=image).delete()

        if boxes is None or boxes.cls is None or boxes.xyxy is None:
            total_images += 1
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
        total_images += 1

    return {
        "images_processed": total_images,
        "annotations_created": total_annotations,
    }
