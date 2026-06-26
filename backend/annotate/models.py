import uuid

from django.conf import settings
from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='ProjectMembership',
        through_fields=('project', 'user'),
        blank=True,
        related_name='annotation_projects',
    )

    def __str__(self) -> str:
        return self.name


class ProjectMembership(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='annotation_project_memberships',
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_annotation_project_memberships',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'user'],
                name='unique_project_member',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.project.name}: {self.user.username}'


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


class Job(models.Model):
    STATUS_NEW = 'new'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_DONE = 'done'
    STATUS_CHOICES = [
        (STATUS_NEW, 'New'),
        (STATUS_IN_PROGRESS, 'In progress'),
        (STATUS_DONE, 'Done'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='jobs')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_annotation_jobs',
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='annotation_jobs',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['project', 'name'], name='unique_project_job_name'),
        ]

    def __str__(self) -> str:
        return f'{self.project.name}: {self.name}'


def project_image_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f"{uuid.uuid4()}.{ext}" if ext else f"{uuid.uuid4()}"
    return f"projects/{instance.job.project_id}/jobs/{instance.job_id}/images/{name}"


class Image(models.Model):
    STATUS_NEW = 'new'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_DONE = 'done'
    STATUS_CHOICES = [
        (STATUS_NEW, 'New'),
        (STATUS_IN_PROGRESS, 'In progress'),
        (STATUS_DONE, 'Done'),
    ]

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='images')
    file = models.ImageField(upload_to=project_image_upload_to)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)

    def __str__(self) -> str:
        return f'{self.job.project.name}/{self.job.name}: {self.file.name}'


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
    MODE_SKIP = 'skip'
    MODE_OVERRIDE = 'override'
    MODE_CHOICES = [
        (MODE_SKIP, 'Skip existing classes'),
        (MODE_OVERRIDE, 'Override annotations'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='auto_annotate_configs')
    model = models.ForeignKey(AIModel, on_delete=models.CASCADE, related_name='auto_annotate_configs')
    is_active = models.BooleanField(default=True)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_SKIP)

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


class AutoAnnotateJob(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    job = models.ForeignKey(
        Job,
        related_name='auto_annotate_jobs',
        on_delete=models.CASCADE,
    )
    config = models.ForeignKey(
        AutoAnnotateConfig,
        related_name='jobs',
        on_delete=models.PROTECT,
    )
    mode = models.CharField(
        max_length=20,
        choices=AutoAnnotateConfig.MODE_CHOICES,
        default=AutoAnnotateConfig.MODE_SKIP,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    total_images = models.PositiveIntegerField(default=0)
    processed_images = models.PositiveIntegerField(default=0)
    annotations_created = models.PositiveIntegerField(default=0)
    progress_percent = models.FloatField(default=0)
    worker_id = models.CharField(max_length=100, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'queued_at']),
            models.Index(fields=['worker_id', 'locked_at']),
        ]
        ordering = ['-queued_at']

    def __str__(self) -> str:
        return f'{self.job}: {self.status}'
