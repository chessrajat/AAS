import uuid

from django.conf import settings
from django.db import models


class TrainingPipeline(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_READY = 'ready'
    STATUS_ARCHIVED = 'archived'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_READY, 'Ready'),
        (STATUS_ARCHIVED, 'Archived'),
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

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    task = models.CharField(max_length=30, choices=TASK_CHOICES, default=TASK_DETECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='training_pipelines',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class TrainingDatasetClass(models.Model):
    pipeline = models.ForeignKey(
        TrainingPipeline,
        related_name='classes',
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=100)
    index = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['pipeline', 'name'],
                name='unique_training_class_name',
            ),
            models.UniqueConstraint(
                fields=['pipeline', 'index'],
                name='unique_training_class_index',
            ),
        ]
        ordering = ['pipeline_id', 'index']

    def __str__(self) -> str:
        return f'{self.pipeline.name}: {self.name}'


class TrainingDataset(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_training_datasets',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


def reusable_training_image_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f'{uuid.uuid4()}.{ext}' if ext else f'{uuid.uuid4()}'
    return f'training/datasets/{instance.dataset_id}/images/{name}'


def reusable_training_label_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f'{uuid.uuid4()}.{ext}' if ext else f'{uuid.uuid4()}'
    return f'training/datasets/{instance.dataset_id}/labels/{name}'


class TrainingDatasetAsset(models.Model):
    dataset = models.ForeignKey(
        TrainingDataset,
        related_name='assets',
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to=reusable_training_image_upload_to)
    label = models.FileField(upload_to=reusable_training_label_upload_to)
    original_image_name = models.CharField(max_length=255)
    original_label_name = models.CharField(max_length=255)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    validation_errors = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['dataset', 'original_image_name'],
                name='unique_training_dataset_image_name',
            ),
            models.UniqueConstraint(
                fields=['dataset', 'original_label_name'],
                name='unique_training_dataset_label_name',
            ),
        ]
        ordering = ['id']

    def __str__(self) -> str:
        return f'{self.dataset.name}: {self.original_image_name}'


def training_image_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f'{uuid.uuid4()}.{ext}' if ext else f'{uuid.uuid4()}'
    return f'training/pipelines/{instance.pipeline_id}/images/{name}'


def training_label_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f'{uuid.uuid4()}.{ext}' if ext else f'{uuid.uuid4()}'
    return f'training/pipelines/{instance.pipeline_id}/labels/{name}'


class TrainingDatasetItem(models.Model):
    SPLIT_TRAIN = 'train'
    SPLIT_VAL = 'val'
    SPLIT_TEST = 'test'
    SPLIT_UNASSIGNED = 'unassigned'
    SPLIT_CHOICES = [
        (SPLIT_TRAIN, 'Train'),
        (SPLIT_VAL, 'Validation'),
        (SPLIT_TEST, 'Test'),
        (SPLIT_UNASSIGNED, 'Unassigned'),
    ]

    pipeline = models.ForeignKey(
        TrainingPipeline,
        related_name='items',
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to=training_image_upload_to)
    label = models.FileField(upload_to=training_label_upload_to, blank=True, null=True)
    original_image_name = models.CharField(max_length=255)
    original_label_name = models.CharField(max_length=255, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    split = models.CharField(
        max_length=20,
        choices=SPLIT_CHOICES,
        default=SPLIT_UNASSIGNED,
        db_index=True,
    )
    validation_errors = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['pipeline', 'split']),
        ]
        ordering = ['id']

    def __str__(self) -> str:
        return f'{self.pipeline.name}: {self.original_image_name}'


class TrainingSplitConfig(models.Model):
    pipeline = models.OneToOneField(
        TrainingPipeline,
        related_name='split_config',
        on_delete=models.CASCADE,
    )
    train_percent = models.PositiveSmallIntegerField(default=80)
    val_percent = models.PositiveSmallIntegerField(default=10)
    test_percent = models.PositiveSmallIntegerField(default=10)
    seed = models.PositiveIntegerField(default=42)
    applied_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return (
            f'{self.pipeline.name}: '
            f'{self.train_percent}/{self.val_percent}/{self.test_percent}'
        )


class TrainingConfig(models.Model):
    pipeline = models.ForeignKey(
        TrainingPipeline,
        related_name='configs',
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=200)
    base_model = models.CharField(max_length=255, default='yolo11n.pt')
    args = models.JSONField(default=dict, blank=True)
    args_schema_version = models.CharField(max_length=50, default='ultralytics-current')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['pipeline', 'name'],
                name='unique_training_config_name',
            ),
        ]
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.pipeline.name}: {self.name}'


class TrainingJob(models.Model):
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

    pipeline = models.ForeignKey(
        TrainingPipeline,
        related_name='jobs',
        on_delete=models.CASCADE,
    )
    config = models.ForeignKey(
        TrainingConfig,
        related_name='jobs',
        on_delete=models.PROTECT,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    current_epoch = models.PositiveIntegerField(default=0)
    total_epochs = models.PositiveIntegerField(default=0)
    progress_percent = models.FloatField(default=0)
    worker_id = models.CharField(max_length=100, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    run_dir = models.CharField(max_length=500, blank=True)
    dataset_yaml_path = models.CharField(max_length=500, blank=True)
    final_args = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'queued_at']),
            models.Index(fields=['worker_id', 'locked_at']),
        ]
        ordering = ['-queued_at']

    def __str__(self) -> str:
        return f'{self.pipeline.name}: {self.status}'


class TrainingEpochMetric(models.Model):
    job = models.ForeignKey(
        TrainingJob,
        related_name='epoch_metrics',
        on_delete=models.CASCADE,
    )
    epoch = models.PositiveIntegerField()
    metrics = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'epoch'],
                name='unique_training_job_epoch',
            ),
        ]
        ordering = ['job_id', 'epoch']

    def __str__(self) -> str:
        return f'{self.job_id}: epoch {self.epoch}'


def training_artifact_upload_to(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    name = f'{uuid.uuid4()}.{ext}' if ext else f'{uuid.uuid4()}'
    return f'training/jobs/{instance.job_id}/artifacts/{name}'


class TrainingArtifact(models.Model):
    TYPE_BEST_MODEL = 'best_model'
    TYPE_LAST_MODEL = 'last_model'
    TYPE_RESULTS = 'results'
    TYPE_CONFUSION_MATRIX = 'confusion_matrix'
    TYPE_LOG = 'log'
    TYPE_DATASET_ZIP = 'dataset_zip'
    TYPE_CHOICES = [
        (TYPE_BEST_MODEL, 'Best model'),
        (TYPE_LAST_MODEL, 'Last model'),
        (TYPE_RESULTS, 'Results'),
        (TYPE_CONFUSION_MATRIX, 'Confusion matrix'),
        (TYPE_LOG, 'Log'),
        (TYPE_DATASET_ZIP, 'Dataset ZIP'),
    ]

    job = models.ForeignKey(
        TrainingJob,
        related_name='artifacts',
        on_delete=models.CASCADE,
    )
    artifact_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    file = models.FileField(upload_to=training_artifact_upload_to)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['job', 'artifact_type']),
        ]
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.job_id}: {self.artifact_type}'
