from PIL import Image as PilImage, UnidentifiedImageError
from django.contrib.auth import get_user_model
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import io
import os
import zipfile

from django.db import IntegrityError, transaction
from django.db.models import Count, OuterRef, Subquery
from django.http import HttpResponse

from .annotate import AutoAnnotateError, get_auto_annotate_config
from .models import (
    AIModel,
    Annotation,
    AutoAnnotateJob,
    ExportJob,
    Image,
    Job,
    Project,
    ProjectClass,
    ProjectMembership,
)
from .serializers import (
    AIModelSerializer,
    AnnotationSerializer,
    AutoAnnotateConfigSerializer,
    AutoAnnotateJobSerializer,
    ExportJobSerializer,
    ImageSerializer,
    JobSerializer,
    ProjectClassSerializer,
    ProjectUserAssignmentSerializer,
    ProjectUserSerializer,
    ProjectSerializer,
)
from .permissions import ALL_PROJECT_ROLES, HasAnnotateRolePermission

User = get_user_model()


def user_can_bypass_project_membership(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def filter_by_project_membership(queryset, user, project_lookup):
    if user_can_bypass_project_membership(user):
        return queryset
    return queryset.filter(**{project_lookup: user}).distinct()


def build_yolo_export(project, images, filename_prefix):
    classes = list(project.classes.all().order_by('index'))

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        data_yaml = "path: .\ntrain: images\nval: images\nnames:\n"
        for label in classes:
            data_yaml += f"  - {label.name}\n"
        archive.writestr('data.yaml', data_yaml)

        for image in images:
            if image.file:
                with image.file.open('rb') as image_file:
                    archive.writestr(
                        os.path.join('images', os.path.basename(image.file.name)),
                        image_file.read(),
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
    response['Content-Disposition'] = f'attachment; filename="{filename_prefix}-yolov8.zip"'
    return response


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = (
        Project.objects
        .prefetch_related('classes', 'jobs', 'members__profile')
        .annotate(
            job_count=Count('jobs', distinct=True),
            first_job_image_file=Subquery(
                Image.objects
                .filter(job__project=OuterRef('pk'))
                .order_by('job_id', 'id')
                .values('file')[:1]
            ),
        )
        .all()
    )
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'list': ALL_PROJECT_ROLES,
        'retrieve': ALL_PROJECT_ROLES,
        'create': {'owner', 'manager'},
        'update': {'owner', 'manager'},
        'partial_update': {'owner', 'manager'},
        'destroy': {'owner'},
        'jobs:GET': ALL_PROJECT_ROLES,
        'jobs:POST': {'owner', 'manager'},
        'users:GET': ALL_PROJECT_ROLES,
        'users:PUT': {'owner', 'manager'},
        'users:PATCH': {'owner', 'manager'},
        'assignable_users': {'owner', 'manager'},
        'add_class': {'owner', 'manager'},
        'export_project': {'owner', 'manager'},
        'auto_annotate_configs:GET': {'owner', 'manager'},
        'auto_annotate_configs:POST': {'owner', 'manager'},
        'auto_annotate_config_detail': {'owner', 'manager'},
    }

    def get_queryset(self):
        return filter_by_project_membership(
            super().get_queryset(),
            self.request.user,
            'members',
        )

    def perform_create(self, serializer):
        project = serializer.save()
        ProjectMembership.objects.get_or_create(
            project=project,
            user=self.request.user,
            defaults={'assigned_by': self.request.user},
        )

    @action(detail=True, methods=['get', 'post'], url_path='jobs')
    def jobs(self, request, pk=None):
        project = self.get_object()
        if request.method.lower() == 'get':
            jobs = (
                project.jobs.annotate(image_count=Count('images'))
                .prefetch_related('assignees')
                .order_by('id')
            )
            serializer = JobSerializer(jobs, many=True, context={'request': request})
            return Response(serializer.data)

        serializer = JobSerializer(
            data=request.data,
            context={'project': project, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            job = serializer.save()
        except IntegrityError:
            return Response(
                {'detail': 'Job name must be unique within this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(JobSerializer(job, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'put', 'patch'], url_path='users')
    def users(self, request, pk=None):
        project = self.get_object()
        if request.method.lower() == 'get':
            users = project.members.select_related('profile').order_by('id')
            return Response(ProjectUserSerializer(users, many=True).data)

        serializer = ProjectUserAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_ids = serializer.validated_data['user_ids']
        if (
            not user_can_bypass_project_membership(request.user)
            and request.user.id not in user_ids
        ):
            return Response(
                {'detail': 'You must keep yourself assigned to this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users = list(User.objects.filter(id__in=user_ids, is_active=True))
        with transaction.atomic():
            project.memberships.exclude(user_id__in=user_ids).delete()
            existing_user_ids = set(
                project.memberships.values_list('user_id', flat=True)
            )
            ProjectMembership.objects.bulk_create(
                [
                    ProjectMembership(
                        project=project,
                        user=user,
                        assigned_by=request.user,
                    )
                    for user in users
                    if user.id not in existing_user_ids
                ],
                ignore_conflicts=True,
            )

        assigned_users = project.members.select_related('profile').order_by('id')
        return Response(ProjectUserSerializer(assigned_users, many=True).data)

    @action(detail=True, methods=['get'], url_path='assignable-users')
    def assignable_users(self, request, pk=None):
        self.get_object()
        users = User.objects.filter(is_active=True).select_related('profile').order_by('id')
        return Response(ProjectUserSerializer(users, many=True).data)

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
        images = list(
            Image.objects.filter(job__project=project)
            .select_related('job')
            .prefetch_related('annotations', 'annotations__project_class')
            .order_by('job_id', 'id')
        )
        return build_yolo_export(project, images, f'project-{project.id}')

    @action(detail=True, methods=['get', 'post'], url_path='auto-annotate/configs')
    def auto_annotate_configs(self, request, pk=None):
        project = self.get_object()
        if request.method.lower() == 'get':
            configs = (
                project.auto_annotate_configs.select_related('model')
                .prefetch_related('mappings', 'mappings__project_class')
                .order_by('id')
            )
            serializer = AutoAnnotateConfigSerializer(
                configs,
                many=True,
                context={'project': project},
            )
            return Response(serializer.data)

        serializer = AutoAnnotateConfigSerializer(
            data=request.data,
            context={'project': project},
        )
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        return Response(
            AutoAnnotateConfigSerializer(
                config,
                context={'project': project},
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['put', 'patch', 'delete'],
        url_path=r'auto-annotate/configs/(?P<config_id>[^/.]+)',
    )
    def auto_annotate_config_detail(self, request, pk=None, config_id=None):
        project = self.get_object()
        config = project.auto_annotate_configs.select_related('model').filter(
            id=config_id
        ).first()
        if not config:
            return Response(
                {'detail': 'Auto-annotate config not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method.lower() == 'delete':
            config.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = AutoAnnotateConfigSerializer(
            config,
            data=request.data,
            partial=request.method.lower() == 'patch',
            context={'project': project},
        )
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        return Response(
            AutoAnnotateConfigSerializer(
                config,
                context={'project': project},
            ).data
        )


class JobViewSet(viewsets.ModelViewSet):
    queryset = (
        Job.objects.select_related('project')
        .prefetch_related('assignees')
        .annotate(image_count=Count('images'))
        .all()
    )
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'list': ALL_PROJECT_ROLES,
        'create': {'owner', 'manager'},
        'retrieve': ALL_PROJECT_ROLES,
        'update': {'owner', 'manager'},
        'partial_update': {'owner', 'manager'},
        'destroy': {'owner', 'manager'},
        'images:GET': ALL_PROJECT_ROLES,
        'images:POST': {'owner', 'manager'},
        'export_job': {'owner', 'manager'},
        'create_export_job': {'owner', 'manager'},
        'export_job_status': ALL_PROJECT_ROLES,
        'auto_annotate_run': {'owner', 'manager'},
        'auto_annotate_job_status': ALL_PROJECT_ROLES,
    }

    def get_queryset(self):
        return filter_by_project_membership(
            super().get_queryset(),
            self.request.user,
            'project__members',
        )

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='images',
        parser_classes=[MultiPartParser, FormParser],
    )
    def images(self, request, pk=None):
        job = self.get_object()
        if request.method.lower() == 'get':
            images = job.images.all().order_by('id')
            serializer = ImageSerializer(images, many=True, context={'request': request})
            return Response(serializer.data)

        files = request.FILES.getlist('images')
        if not files:
            return Response(
                {'detail': 'No images provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        try:
            with transaction.atomic():
                for file_obj in files:
                    try:
                        with PilImage.open(file_obj) as image_file:
                            width, height = image_file.size
                    except (UnidentifiedImageError, OSError):
                        return Response(
                            {'detail': f"Invalid image file: {file_obj.name}."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    file_obj.seek(0)
                    created.append(
                        Image.objects.create(
                            job=job,
                            file=file_obj,
                            width=width,
                            height=height,
                        )
                    )
        except Exception:
            return Response(
                {'detail': 'Upload failed while saving images.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = ImageSerializer(created, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='export')
    def export_job(self, request, pk=None):
        job = self.get_object()
        images = list(
            job.images.prefetch_related('annotations', 'annotations__project_class')
            .order_by('id')
        )
        return build_yolo_export(job.project, images, f'job-{job.id}')

    @action(detail=True, methods=['post'], url_path='exports')
    def create_export_job(self, request, pk=None):
        job = self.get_object()
        export_job = ExportJob.objects.create(
            job=job,
            total_images=job.images.count(),
        )
        return Response(
            ExportJobSerializer(export_job, context={'request': request}).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(
        detail=True,
        methods=['get'],
        url_path=r'exports/(?P<export_job_id>[^/.]+)',
    )
    def export_job_status(self, request, pk=None, export_job_id=None):
        job = self.get_object()
        export_job = job.export_jobs.filter(id=export_job_id).first()
        if not export_job:
            return Response(
                {'detail': 'Export job not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ExportJobSerializer(export_job, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='auto-annotate/run')
    def auto_annotate_run(self, request, pk=None):
        job = self.get_object()
        model_id = request.data.get('model_id')
        if isinstance(model_id, list):
            model_id = model_id[0]
        if model_id is not None:
            try:
                model_id = int(model_id)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'Invalid model_id.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        try:
            config = get_auto_annotate_config(job.project, model_id=model_id)
        except AutoAnnotateError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        auto_annotate_job = AutoAnnotateJob.objects.create(
            job=job,
            config=config,
            mode=config.mode,
            total_images=job.images.count(),
        )
        return Response(
            AutoAnnotateJobSerializer(auto_annotate_job).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(
        detail=True,
        methods=['get'],
        url_path=r'auto-annotate/jobs/(?P<auto_annotate_job_id>[^/.]+)',
    )
    def auto_annotate_job_status(self, request, pk=None, auto_annotate_job_id=None):
        job = self.get_object()
        auto_annotate_job = (
            job.auto_annotate_jobs.select_related('config', 'config__model')
            .filter(id=auto_annotate_job_id)
            .first()
        )
        if not auto_annotate_job:
            return Response(
                {'detail': 'Auto-annotate job not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(AutoAnnotateJobSerializer(auto_annotate_job).data)


class ImageViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Image.objects.select_related('job', 'job__project').all()
    serializer_class = ImageSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'destroy': {'owner', 'manager'},
        'annotations:GET': ALL_PROJECT_ROLES,
        'annotations:POST': {'owner', 'manager', 'annotator'},
        'mark_done': {'owner', 'manager', 'annotator'},
    }

    def get_queryset(self):
        return filter_by_project_membership(
            super().get_queryset(),
            self.request.user,
            'job__project__members',
        )

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
        if project_class.project_id != image.job.project_id:
            return Response(
                {'detail': 'Project class does not belong to this image project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        annotation = serializer.save(image=image)
        if image.status != Image.STATUS_IN_PROGRESS:
            image.status = Image.STATUS_IN_PROGRESS
            image.save(update_fields=['status'])
        return Response(
            AnnotationSerializer(annotation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='mark-done')
    def mark_done(self, request, pk=None):
        image = self.get_object()
        if image.status != Image.STATUS_DONE:
            image.status = Image.STATUS_DONE
            image.save(update_fields=['status'])
        return Response(ImageSerializer(image, context={'request': request}).data)

    def destroy(self, request, *args, **kwargs):
        image = self.get_object()
        Annotation.objects.filter(image=image).delete()
        return super().destroy(request, *args, **kwargs)


class AnnotationViewSet(
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Annotation.objects.select_related('image', 'image__job', 'project_class').all()
    serializer_class = AnnotationSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'update': {'owner', 'manager', 'annotator'},
        'partial_update': {'owner', 'manager', 'annotator'},
        'destroy': {'owner', 'manager', 'annotator'},
    }

    def get_queryset(self):
        return filter_by_project_membership(
            super().get_queryset(),
            self.request.user,
            'image__job__project__members',
        )

    def perform_update(self, serializer):
        annotation = serializer.save()
        image = annotation.image
        if image.status != Image.STATUS_IN_PROGRESS:
            image.status = Image.STATUS_IN_PROGRESS
            image.save(update_fields=['status'])

    def perform_destroy(self, instance):
        image = instance.image
        instance.delete()
        if image.status != Image.STATUS_IN_PROGRESS:
            image.status = Image.STATUS_IN_PROGRESS
            image.save(update_fields=['status'])


class ProjectClassViewSet(
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ProjectClass.objects.select_related('project').all()
    serializer_class = ProjectClassSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'destroy': {'owner', 'manager'},
    }

    def get_queryset(self):
        return filter_by_project_membership(
            super().get_queryset(),
            self.request.user,
            'project__members',
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        image_ids = list(
            Annotation.objects.filter(project_class=instance).values_list('image_id', flat=True)
        )
        Annotation.objects.filter(project_class=instance).delete()
        if image_ids:
            Image.objects.filter(id__in=image_ids).update(status=Image.STATUS_IN_PROGRESS)
        return super().destroy(request, *args, **kwargs)


class AIModelViewSet(viewsets.ModelViewSet):
    queryset = AIModel.objects.all().order_by('id')
    serializer_class = AIModelSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'list': ALL_PROJECT_ROLES,
        'retrieve': ALL_PROJECT_ROLES,
        'create': {'owner', 'manager'},
        'update': {'owner', 'manager'},
        'partial_update': {'owner', 'manager'},
        'destroy': {'owner', 'manager'},
    }
