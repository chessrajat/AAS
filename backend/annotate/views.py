from PIL import Image as PilImage
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Image, Project
from .serializers import ImageSerializer, ProjectSerializer


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
