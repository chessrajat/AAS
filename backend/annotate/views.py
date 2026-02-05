from PIL import Image as PilImage
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db import IntegrityError

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


class ImageViewSet(viewsets.GenericViewSet):
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
