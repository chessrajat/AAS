import os
import tempfile

from django.db import IntegrityError, transaction
from rest_framework import serializers
from ultralytics import YOLO

from .models import (
    AIModel,
    Annotation,
    AutoAnnotateClassMapping,
    AutoAnnotateConfig,
    Image,
    Project,
    ProjectClass,
)


class ProjectClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectClass
        fields = ('id', 'name', 'index', 'color')


class AIModelSerializer(serializers.ModelSerializer):
    classes = serializers.JSONField(read_only=True)

    class Meta:
        model = AIModel
        fields = (
            'id',
            'name',
            'description',
            'model_type',
            'task',
            'file',
            'classes',
            'is_active',
        )
        read_only_fields = ('classes',)

    def _extract_metadata_from_file(self, file_obj):
        temp_path = None
        try:
            if hasattr(file_obj, 'temporary_file_path'):
                temp_path = file_obj.temporary_file_path()
            else:
                _, ext = os.path.splitext(file_obj.name or '')
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
                    for chunk in file_obj.chunks():
                        temp_file.write(chunk)
                    temp_path = temp_file.name
                if hasattr(file_obj, 'seek'):
                    file_obj.seek(0)

            model = YOLO(temp_path)
            names = model.names
            task = getattr(model, "task", None) or getattr(model, "task_type", None)
            classes = None
            if isinstance(names, dict):
                classes = [names[index] for index in sorted(names)]
            elif isinstance(names, (list, tuple)):
                classes = list(names)
            if classes is None:
                raise ValueError("Unsupported class metadata format.")
            return {
                "classes": classes,
                "task": task,
            }
        except Exception as exc:
            raise serializers.ValidationError(
                {"file": "Not a valid YOLO model file."}
            )
        finally:
            if temp_path and not hasattr(file_obj, 'temporary_file_path'):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

    def create(self, validated_data):
        validated_data.pop('classes', None)
        model_file = validated_data.get('file')
        metadata = self._extract_metadata_from_file(model_file)
        validated_data['classes'] = metadata["classes"]
        if metadata.get("task") in {choice[0] for choice in AIModel.TASK_CHOICES}:
            validated_data["task"] = metadata["task"]
        validated_data.setdefault("is_active", True)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('classes', None)
        model_file = validated_data.get('file')
        if model_file is not None:
            metadata = self._extract_metadata_from_file(model_file)
            validated_data['classes'] = metadata["classes"]
            if metadata.get("task") in {choice[0] for choice in AIModel.TASK_CHOICES}:
                validated_data["task"] = metadata["task"]
        return super().update(instance, validated_data)


class ProjectSerializer(serializers.ModelSerializer):
    classes = ProjectClassSerializer(many=True, required=False)

    class Meta:
        model = Project
        fields = ('id', 'name', 'description', 'classes')

    def validate_classes(self, value):
        names = [item.get('name') for item in value if item.get('name') is not None]
        indices = [item.get('index') for item in value if item.get('index') is not None]
        if len(names) != len(set(names)):
            raise serializers.ValidationError("Class names must be unique.")
        if len(indices) != len(set(indices)):
            raise serializers.ValidationError("Class indices must be unique.")
        return value

    def create(self, validated_data):
        classes_data = validated_data.pop('classes', [])
        try:
            with transaction.atomic():
                project = Project.objects.create(**validated_data)
                for class_data in classes_data:
                    ProjectClass.objects.create(project=project, **class_data)
        except IntegrityError:
            raise serializers.ValidationError(
                "Class names and indices must be unique within a project."
            )
        return project

    def update(self, instance, validated_data):
        classes_data = validated_data.pop('classes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if classes_data is not None:
            instance.classes.all().delete()
            for class_data in classes_data:
                ProjectClass.objects.create(project=instance, **class_data)

        return instance


class AutoAnnotateClassMappingSerializer(serializers.ModelSerializer):
    project_class = serializers.PrimaryKeyRelatedField(queryset=ProjectClass.objects.all())

    class Meta:
        model = AutoAnnotateClassMapping
        fields = ('id', 'model_class', 'project_class')


class AutoAnnotateConfigSerializer(serializers.ModelSerializer):
    model = AIModelSerializer(read_only=True)
    model_id = serializers.PrimaryKeyRelatedField(
        source='model',
        queryset=AIModel.objects.all(),
        write_only=True,
    )
    mappings = AutoAnnotateClassMappingSerializer(many=True)

    class Meta:
        model = AutoAnnotateConfig
        fields = ('id', 'model', 'model_id', 'is_active', 'mappings')

    def validate(self, attrs):
        project = self.context.get('project')
        model = attrs.get('model') or self.instance.model if self.instance else None
        if not model:
            model_id = self.initial_data.get('model_id')
            if isinstance(model_id, list):
                model_id = model_id[0]
            if model_id is not None:
                try:
                    model = AIModel.objects.get(pk=model_id)
                    attrs['model'] = model
                except (AIModel.DoesNotExist, ValueError, TypeError):
                    model = None
        if not project:
            raise serializers.ValidationError("Missing project context.")
        if not model:
            raise serializers.ValidationError({"model_id": "Model is required."})
        mappings = attrs.get('mappings', [])
        model_class_count = len(model.classes or [])
        invalid = [
            item['model_class']
            for item in mappings
            if not isinstance(item['model_class'], int)
            or item['model_class'] < 0
            or item['model_class'] >= model_class_count
        ]
        if invalid:
            raise serializers.ValidationError(
                {"mappings": "One or more model class indices are invalid."}
            )
        for item in mappings:
            project_class = item.get('project_class')
            if project_class and project_class.project_id != project.id:
                raise serializers.ValidationError(
                    {"mappings": "Project class does not belong to this project."}
                )
        return attrs

    def create(self, validated_data):
        mappings_data = validated_data.pop('mappings', [])
        project = self.context.get('project')
        config = AutoAnnotateConfig.objects.create(project=project, **validated_data)
        for mapping in mappings_data:
            AutoAnnotateClassMapping.objects.create(config=config, **mapping)
        return config

    def update(self, instance, validated_data):
        mappings_data = validated_data.pop('mappings', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if mappings_data is not None:
            instance.mappings.all().delete()
            for mapping in mappings_data:
                AutoAnnotateClassMapping.objects.create(config=instance, **mapping)

        return instance


class ImageSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = ('id', 'file', 'file_url', 'width', 'height', 'status')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if not obj.file:
            return None
        if request is None:
            return obj.file.url
        return request.build_absolute_uri(obj.file.url)


class AnnotationSerializer(serializers.ModelSerializer):
    image = serializers.PrimaryKeyRelatedField(read_only=True)
    project_class = serializers.PrimaryKeyRelatedField(queryset=ProjectClass.objects.all())

    class Meta:
        model = Annotation
        fields = ('id', 'image', 'project_class', 'x_min', 'y_min', 'x_max', 'y_max')
