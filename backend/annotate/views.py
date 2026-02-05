from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.prefetch_related('classes').all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
