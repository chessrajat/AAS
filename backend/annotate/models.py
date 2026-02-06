import uuid

from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class AIModel(models.Model):
    MODEL_TYPE_YOLO = 'yolo'
    MODEL_TYPE_CHOICES = [
        (MODEL_TYPE_YOLO, 'YOLO'),
    ]
    TASK_DETECT = 'detect'
    TASK_SEGMENT = 'segment'
    TASK_CLASSIFY = 'classify'
    TASK_POSE = 'pose'
    TASK_OBB = 'obb'
    TASK_CHOICES = [
        (TASK_DETECT, 'Detect'),
        (TASK_SEGMENT, 'Segment'),
        (TASK_CLASSIFY, 'Classify'),
        (TASK_POSE, 'Pose'),
        (TASK_OBB, 'OBB'),
    ]

    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    model_type = models.CharField(
        max_length=20,
        choices=MODEL_TYPE_CHOICES,
        default=MODEL_TYPE_YOLO,
    )
    task = models.CharField(
        max_length=20,
        choices=TASK_CHOICES,
        default=TASK_DETECT,
    )
    file = models.FileField(upload_to='models/')
    classes = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class ProjectClass(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='classes')
    name = models.CharField(max_length=100)
    index = models.PositiveIntegerField()
    color = models.CharField(max_length=7, default='#3b82f6')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['project', 'name'], name='unique_project_class'),
            models.UniqueConstraint(fields=['project', 'index'], name='unique_project_class_index')
        ]

    def __str__(self) -> str:
        return f'{self.project.name}: {self.name}'


def project_image_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f"{uuid.uuid4()}.{ext}" if ext else f"{uuid.uuid4()}"
    return f"projects/{instance.project_id}/images/{name}"


class Image(models.Model):
    STATUS_NEW = 'new'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_DONE = 'done'
    STATUS_CHOICES = [
        (STATUS_NEW, 'New'),
        (STATUS_IN_PROGRESS, 'In progress'),
        (STATUS_DONE, 'Done'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='images')
    file = models.ImageField(upload_to=project_image_upload_to)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)

    def __str__(self) -> str:
        return f'{self.project.name}: {self.file.name}'


class Annotation(models.Model):
    image = models.ForeignKey(Image, on_delete=models.CASCADE, related_name='annotations')
    project_class = models.ForeignKey(ProjectClass, on_delete=models.CASCADE, related_name='annotations')
    x_min = models.PositiveIntegerField()
    y_min = models.PositiveIntegerField()
    x_max = models.PositiveIntegerField()
    y_max = models.PositiveIntegerField()

    def __str__(self) -> str:
        return f'{self.project_class.name} ({self.x_min},{self.y_min})-({self.x_max},{self.y_max})'


class AutoAnnotateConfig(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='auto_annotate_configs')
    model = models.ForeignKey(AIModel, on_delete=models.CASCADE, related_name='auto_annotate_configs')
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'model'],
                name='unique_auto_annotate_config',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.project.name}: {self.model.name}'


class AutoAnnotateClassMapping(models.Model):
    config = models.ForeignKey(
        AutoAnnotateConfig,
        on_delete=models.CASCADE,
        related_name='mappings',
    )
    model_class = models.PositiveIntegerField()
    project_class = models.ForeignKey(
        ProjectClass,
        on_delete=models.CASCADE,
        related_name='auto_annotate_mappings',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['config', 'model_class'],
                name='unique_auto_annotate_mapping',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.config.model.name}: {self.model_class} -> {self.project_class.name}'
