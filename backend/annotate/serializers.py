from rest_framework import serializers

from .models import Project, ProjectClass


class ProjectClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectClass
        fields = ('id', 'name', 'index', 'color')


class ProjectSerializer(serializers.ModelSerializer):
    classes = ProjectClassSerializer(many=True, required=False)

    class Meta:
        model = Project
        fields = ('id', 'name', 'description', 'classes')

    def create(self, validated_data):
        classes_data = validated_data.pop('classes', [])
        project = Project.objects.create(**validated_data)
        for class_data in classes_data:
            ProjectClass.objects.create(project=project, **class_data)
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
