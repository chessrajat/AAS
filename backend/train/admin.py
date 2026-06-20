from django.contrib import admin

from .models import (
    TrainingArtifact,
    TrainingConfig,
    TrainingDataset,
    TrainingDatasetAsset,
    TrainingDatasetClass,
    TrainingDatasetItem,
    TrainingEpochMetric,
    TrainingJob,
    TrainingPipeline,
    TrainingSplitConfig,
)


class TrainingDatasetAssetInline(admin.TabularInline):
    model = TrainingDatasetAsset
    extra = 0
    readonly_fields = ('width', 'height', 'created_at')


@admin.register(TrainingDataset)
class TrainingDatasetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_by', 'created_at', 'updated_at')
    search_fields = ('name', 'description')
    inlines = (TrainingDatasetAssetInline,)


@admin.register(TrainingDatasetAsset)
class TrainingDatasetAssetAdmin(admin.ModelAdmin):
    list_display = ('id', 'dataset', 'original_image_name', 'original_label_name', 'width', 'height', 'created_at')
    list_filter = ('dataset', 'created_at')
    search_fields = ('dataset__name', 'original_image_name', 'original_label_name')


class TrainingDatasetClassInline(admin.TabularInline):
    model = TrainingDatasetClass
    extra = 0


@admin.register(TrainingPipeline)
class TrainingPipelineAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'task', 'status', 'created_by', 'created_at')
    list_filter = ('task', 'status', 'created_at')
    search_fields = ('name', 'description')
    inlines = (TrainingDatasetClassInline,)


@admin.register(TrainingDatasetClass)
class TrainingDatasetClassAdmin(admin.ModelAdmin):
    list_display = ('id', 'pipeline', 'name', 'index')
    list_filter = ('pipeline',)
    search_fields = ('name', 'pipeline__name')


@admin.register(TrainingDatasetItem)
class TrainingDatasetItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'pipeline', 'original_image_name', 'split', 'width', 'height', 'created_at')
    list_filter = ('pipeline', 'split', 'created_at')
    search_fields = ('original_image_name', 'original_label_name', 'pipeline__name')


@admin.register(TrainingSplitConfig)
class TrainingSplitConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'pipeline', 'train_percent', 'val_percent', 'test_percent', 'seed', 'applied_at')
    search_fields = ('pipeline__name',)


@admin.register(TrainingConfig)
class TrainingConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'pipeline', 'name', 'base_model', 'args_schema_version', 'created_at')
    list_filter = ('pipeline', 'created_at')
    search_fields = ('name', 'base_model', 'pipeline__name')


@admin.register(TrainingJob)
class TrainingJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'pipeline', 'config', 'status', 'current_epoch', 'total_epochs', 'queued_at')
    list_filter = ('status', 'pipeline', 'queued_at')
    search_fields = ('pipeline__name', 'config__name', 'worker_id')


@admin.register(TrainingEpochMetric)
class TrainingEpochMetricAdmin(admin.ModelAdmin):
    list_display = ('id', 'job', 'epoch', 'created_at')
    list_filter = ('job__pipeline', 'created_at')
    search_fields = ('job__pipeline__name',)


@admin.register(TrainingArtifact)
class TrainingArtifactAdmin(admin.ModelAdmin):
    list_display = ('id', 'job', 'artifact_type', 'file', 'created_at')
    list_filter = ('artifact_type', 'job__pipeline', 'created_at')
    search_fields = ('job__pipeline__name', 'file')
