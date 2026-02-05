from PIL import Image as PilImage
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import io
import os
import zipfile

from django.db import IntegrityError
from django.http import HttpResponse

from .models import Annotation, Image, Project, ProjectClass
from .serializers import AnnotationSerializer, ImageSerializer, ProjectClassSerializer, ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.prefetch_related('classes').all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='images',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_images(self, request, pk=None):
        project = self.get_object()
        if request.method.lower() == 'get':
            images = project.images.all().order_by('id')
            serializer = ImageSerializer(images, many=True, context={'request': request})
            return Response(serializer.data)

        files = request.FILES.getlist('images')
        if not files:
            return Response(
                {'detail': 'No images provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        for file_obj in files:
            image = PilImage.open(file_obj)
            width, height = image.size
            created.append(
                Image.objects.create(
                    project=project,
                    file=file_obj,
                    width=width,
                    height=height,
                )
            )

        serializer = ImageSerializer(created, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='classes')
    def add_class(self, request, pk=None):
        project = self.get_object()
        serializer = ProjectClassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            project_class = ProjectClass.objects.create(
                project=project,
                **serializer.validated_data,
            )
        except IntegrityError:
            return Response(
                {'detail': 'Label name or index must be unique.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(ProjectClassSerializer(project_class).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='export')
    def export_project(self, request, pk=None):
        project = self.get_object()
        classes = list(project.classes.all().order_by('index'))
        images = list(project.images.all().order_by('id'))

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
            names = [label.name for label in classes]
            data_yaml = "path: .\ntrain: images\nval: images\nnames:\n"
            for name in names:
                data_yaml += f"  - {name}\n"
            archive.writestr('data.yaml', data_yaml)

            for image in images:
                if image.file and os.path.exists(image.file.path):
                    archive.write(
                        image.file.path,
                        arcname=os.path.join('images', os.path.basename(image.file.name)),
                    )

                annotations = image.annotations.select_related('project_class').all()
                label_lines = []
                for annotation in annotations:
                    if image.width == 0 or image.height == 0:
                        continue
                    class_index = annotation.project_class.index
                    x_center = (annotation.x_min + annotation.x_max) / 2 / image.width
                    y_center = (annotation.y_min + annotation.y_max) / 2 / image.height
                    box_w = (annotation.x_max - annotation.x_min) / image.width
                    box_h = (annotation.y_max - annotation.y_min) / image.height
                    label_lines.append(
                        f"{class_index} {x_center:.6f} {y_center:.6f} {box_w:.6f} {box_h:.6f}"
                    )

                label_name = os.path.splitext(os.path.basename(image.file.name))[0] + '.txt'
                archive.writestr(os.path.join('labels', label_name), "\n".join(label_lines))

        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="project-{project.id}-yolov8.zip"'
        return response


class ImageViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Image.objects.select_related('project').all()
    serializer_class = ImageSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get', 'post'], url_path='annotations')
    def annotations(self, request, pk=None):
        image = self.get_object()
        if request.method.lower() == 'get':
            annotations = image.annotations.select_related('project_class').all().order_by('id')
            serializer = AnnotationSerializer(annotations, many=True)
            return Response(serializer.data)

        serializer = AnnotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project_class = serializer.validated_data['project_class']
        if project_class.project_id != image.project_id:
            return Response(
                {'detail': 'Project class does not belong to this image project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        annotation = serializer.save(image=image)
        return Response(
            AnnotationSerializer(annotation).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        image = self.get_object()
        Annotation.objects.filter(image=image).delete()
        return super().destroy(request, *args, **kwargs)


class AnnotationViewSet(
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Annotation.objects.select_related('image', 'project_class').all()
    serializer_class = AnnotationSerializer
    permission_classes = [IsAuthenticated]


class ProjectClassViewSet(
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ProjectClass.objects.select_related('project').all()
    serializer_class = ProjectClassSerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        Annotation.objects.filter(project_class=instance).delete()
        return super().destroy(request, *args, **kwargs)
