from rest_framework import serializers

from .models import (
    TrainingArtifact,
    TrainingConfig,
    TrainingDatasetClass,
    TrainingDatasetItem,
    TrainingEpochMetric,
    TrainingJob,
    TrainingPipeline,
    TrainingSplitConfig,
)


class TrainingDatasetClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingDatasetClass
        fields = ('id', 'name', 'index')


class TrainingSplitConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSplitConfig
        fields = ('id', 'train_percent', 'val_percent', 'test_percent', 'seed', 'applied_at')
        read_only_fields = ('applied_at',)

    def validate(self, attrs):
        train_percent = attrs.get('train_percent', self.instance.train_percent if self.instance else 80)
        val_percent = attrs.get('val_percent', self.instance.val_percent if self.instance else 10)
        test_percent = attrs.get('test_percent', self.instance.test_percent if self.instance else 10)
        if train_percent + val_percent + test_percent != 100:
            raise serializers.ValidationError('Train, validation, and test percentages must total 100.')
        return attrs


class TrainingDatasetItemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    label_url = serializers.SerializerMethodField()

    class Meta:
        model = TrainingDatasetItem
        fields = (
            'id',
            'image',
            'image_url',
            'label',
            'label_url',
            'original_image_name',
            'original_label_name',
            'width',
            'height',
            'split',
            'validation_errors',
            'created_at',
        )
        read_only_fields = fields

    def get_image_url(self, obj):
        request = self.context.get('request')
        if not obj.image:
            return None
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def get_label_url(self, obj):
        request = self.context.get('request')
        if not obj.label:
            return None
        return request.build_absolute_uri(obj.label.url) if request else obj.label.url


class TrainingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingConfig
        fields = ('id', 'name', 'base_model', 'args', 'args_schema_version', 'created_at')
        read_only_fields = ('created_at',)


class TrainingEpochMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingEpochMetric
        fields = ('id', 'epoch', 'metrics', 'created_at')


class TrainingArtifactSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TrainingArtifact
        fields = ('id', 'artifact_type', 'file', 'file_url', 'metadata', 'created_at')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if not obj.file:
            return None
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class TrainingJobSerializer(serializers.ModelSerializer):
    config_detail = TrainingConfigSerializer(source='config', read_only=True)

    class Meta:
        model = TrainingJob
        fields = (
            'id',
            'pipeline',
            'config',
            'config_detail',
            'status',
            'queued_at',
            'started_at',
            'finished_at',
            'current_epoch',
            'total_epochs',
            'progress_percent',
            'worker_id',
            'locked_at',
            'error_message',
            'run_dir',
            'dataset_yaml_path',
            'final_args',
        )
        read_only_fields = (
            'pipeline',
            'status',
            'queued_at',
            'started_at',
            'finished_at',
            'current_epoch',
            'total_epochs',
            'progress_percent',
            'worker_id',
            'locked_at',
            'error_message',
            'run_dir',
            'dataset_yaml_path',
            'final_args',
        )


class TrainingPipelineSerializer(serializers.ModelSerializer):
    classes = TrainingDatasetClassSerializer(many=True, required=False)
    split_config = TrainingSplitConfigSerializer(read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    train_count = serializers.IntegerField(read_only=True)
    val_count = serializers.IntegerField(read_only=True)
    test_count = serializers.IntegerField(read_only=True)
    unassigned_count = serializers.IntegerField(read_only=True)
    job_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = TrainingPipeline
        fields = (
            'id',
            'name',
            'description',
            'task',
            'status',
            'classes',
            'split_config',
            'item_count',
            'train_count',
            'val_count',
            'test_count',
            'unassigned_count',
            'job_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('status', 'created_at', 'updated_at')

    def validate_classes(self, value):
        names = [item.get('name') for item in value if item.get('name') is not None]
        indices = [item.get('index') for item in value if item.get('index') is not None]
        if len(names) != len(set(names)):
            raise serializers.ValidationError('Class names must be unique.')
        if len(indices) != len(set(indices)):
            raise serializers.ValidationError('Class indices must be unique.')
        return value

    def create(self, validated_data):
        classes_data = validated_data.pop('classes', [])
        request = self.context.get('request')
        pipeline = TrainingPipeline.objects.create(
            created_by=request.user if request and request.user.is_authenticated else None,
            **validated_data,
        )
        for class_data in classes_data:
            TrainingDatasetClass.objects.create(pipeline=pipeline, **class_data)
        TrainingSplitConfig.objects.create(pipeline=pipeline)
        return pipeline
