from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import Annotation, Image, Project, ProjectClass


class ProjectClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectClass
        fields = ('id', 'name', 'index', 'color')


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
