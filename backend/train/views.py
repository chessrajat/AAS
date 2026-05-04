from PIL import Image as PilImage, UnidentifiedImageError
from django.core.files import File
from django.core.files.storage import default_storage
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import io
import os
import random
import tempfile
import zipfile
from pathlib import Path

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import FileResponse, Http404, HttpResponse
from django.utils import timezone

from accounts.models import UserProfile
from annotate.permissions import ALL_PROJECT_ROLES, HasAnnotateRolePermission

from .models import (
    TrainingConfig,
    TrainingArtifact,
    TrainingDatasetClass,
    TrainingDatasetItem,
    TrainingJob,
    TrainingPipeline,
    TrainingSplitConfig,
)
from .serializers import (
    TrainingConfigSerializer,
    TrainingArtifactSerializer,
    TrainingDatasetClassSerializer,
    TrainingDatasetItemSerializer,
    TrainingJobSerializer,
    TrainingPipelineSerializer,
    TrainingSplitConfigSerializer,
)


MANAGE_TRAINING_ROLES = {
    UserProfile.Role.OWNER,
    UserProfile.Role.MANAGER,
}

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}


def _stem_from_name(name):
    return Path(name).stem


def _create_training_item(pipeline, image_file, label_file=None, image_name=None, label_name=''):
    validation_errors = []
    try:
        with PilImage.open(image_file) as opened_image:
            width, height = opened_image.size
    except (UnidentifiedImageError, OSError):
        raise ValueError(f'Invalid image file: {image_name or getattr(image_file, "name", "unknown")}.')

    if label_file is None:
        validation_errors.append('Matching label file not found.')

    if hasattr(image_file, 'seek'):
        image_file.seek(0)
    if label_file is not None and hasattr(label_file, 'seek'):
        label_file.seek(0)

    return TrainingDatasetItem.objects.create(
        pipeline=pipeline,
        image=image_file,
        label=label_file,
        original_image_name=image_name or getattr(image_file, 'name', ''),
        original_label_name=label_name or (getattr(label_file, 'name', '') if label_file else ''),
        width=width,
        height=height,
        validation_errors=validation_errors,
    )


def _is_safe_zip_member(member_name):
    normalized_name = member_name.replace('\\', '/')
    path = Path(normalized_name)
    return (
        member_name
        and not path.is_absolute()
        and '..' not in path.parts
    )


def _artifact_download_name(artifact):
    filename = os.path.basename(artifact.file.name or '')
    return filename or f'training-artifact-{artifact.id}'


def _open_artifact_file(artifact):
    if not artifact.file:
        raise Http404('Artifact file not found.')
    if not default_storage.exists(artifact.file.name):
        raise Http404('Artifact file not found.')
    return default_storage.open(artifact.file.name, 'rb')


def pipeline_queryset():
    return (
        TrainingPipeline.objects.prefetch_related('classes')
        .select_related('split_config')
        .annotate(
            item_count=Count('items', distinct=True),
            train_count=Count('items', filter=Q(items__split=TrainingDatasetItem.SPLIT_TRAIN), distinct=True),
            val_count=Count('items', filter=Q(items__split=TrainingDatasetItem.SPLIT_VAL), distinct=True),
            test_count=Count('items', filter=Q(items__split=TrainingDatasetItem.SPLIT_TEST), distinct=True),
            unassigned_count=Count(
                'items',
                filter=Q(items__split=TrainingDatasetItem.SPLIT_UNASSIGNED),
                distinct=True,
            ),
            job_count=Count('jobs', distinct=True),
        )
        .order_by('-updated_at')
    )


class TrainingPipelineViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPipelineSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'list': ALL_PROJECT_ROLES,
        'retrieve': ALL_PROJECT_ROLES,
        'create': MANAGE_TRAINING_ROLES,
        'update': MANAGE_TRAINING_ROLES,
        'partial_update': MANAGE_TRAINING_ROLES,
        'destroy': MANAGE_TRAINING_ROLES,
        'classes:GET': ALL_PROJECT_ROLES,
        'classes:POST': MANAGE_TRAINING_ROLES,
        'items': ALL_PROJECT_ROLES,
        'upload_items': MANAGE_TRAINING_ROLES,
        'upload_zip': MANAGE_TRAINING_ROLES,
        'split_config:GET': ALL_PROJECT_ROLES,
        'split_config:PUT': MANAGE_TRAINING_ROLES,
        'apply_split': MANAGE_TRAINING_ROLES,
        'configs:GET': ALL_PROJECT_ROLES,
        'configs:POST': MANAGE_TRAINING_ROLES,
        'jobs:GET': ALL_PROJECT_ROLES,
        'jobs:POST': MANAGE_TRAINING_ROLES,
    }

    def get_queryset(self):
        return pipeline_queryset()

    @action(detail=True, methods=['get', 'post'], url_path='classes')
    def classes(self, request, pk=None):
        pipeline = self.get_object()
        if request.method.lower() == 'get':
            serializer = TrainingDatasetClassSerializer(
                pipeline.classes.all().order_by('index'),
                many=True,
            )
            return Response(serializer.data)

        serializer = TrainingDatasetClassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            training_class = TrainingDatasetClass.objects.create(
                pipeline=pipeline,
                **serializer.validated_data,
            )
        except IntegrityError:
            return Response(
                {'detail': 'Class name or index must be unique.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            TrainingDatasetClassSerializer(training_class).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='items')
    def items(self, request, pk=None):
        pipeline = self.get_object()
        split = request.query_params.get('split')
        items = pipeline.items.all().order_by('id')
        if split:
            items = items.filter(split=split)
        serializer = TrainingDatasetItemSerializer(
            items,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['post'],
        url_path='items/upload',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_items(self, request, pk=None):
        pipeline = self.get_object()
        images = request.FILES.getlist('images')
        labels = request.FILES.getlist('labels')
        if not images:
            return Response(
                {'detail': 'No images provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        labels_by_stem = {_stem_from_name(label.name): label for label in labels}
        created = []
        with transaction.atomic():
            for image_file in images:
                image_stem = _stem_from_name(image_file.name)
                label_file = labels_by_stem.get(image_stem)
                try:
                    created.append(
                        _create_training_item(
                            pipeline,
                            image_file,
                            label_file=label_file,
                            image_name=image_file.name,
                            label_name=label_file.name if label_file else '',
                        )
                    )
                except ValueError as exc:
                    return Response(
                        {'detail': str(exc)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        serializer = TrainingDatasetItemSerializer(
            created,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        url_path='items/upload-zip',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_zip(self, request, pk=None):
        pipeline = self.get_object()
        archive = request.FILES.get('archive')
        if not archive:
            return Response(
                {'detail': 'No archive provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                archive_path = temp_path / 'dataset.zip'
                with archive_path.open('wb') as destination:
                    for chunk in archive.chunks():
                        destination.write(chunk)

                try:
                    with zipfile.ZipFile(archive_path) as zip_file:
                        members = zip_file.infolist()
                        unsafe = [
                            member.filename
                            for member in members
                            if not _is_safe_zip_member(member.filename)
                        ]
                        if unsafe:
                            return Response(
                                {'detail': 'Archive contains unsafe paths.'},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        zip_file.extractall(temp_path / 'extracted')
                except zipfile.BadZipFile:
                    return Response(
                        {'detail': 'Invalid ZIP archive.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                extracted_dir = temp_path / 'extracted'
                image_paths = [
                    path
                    for path in extracted_dir.rglob('*')
                    if path.is_file()
                    and path.suffix.lower() in IMAGE_EXTENSIONS
                    and 'images' in path.relative_to(extracted_dir).parts
                ]
                label_paths = [
                    path
                    for path in extracted_dir.rglob('*.txt')
                    if path.is_file()
                    and 'labels' in path.relative_to(extracted_dir).parts
                ]
                labels_by_stem = {path.stem: path for path in label_paths}

                if not image_paths:
                    return Response(
                        {'detail': 'Archive contains no images under an images/ folder.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                with transaction.atomic():
                    for image_path in sorted(image_paths):
                        label_path = labels_by_stem.get(image_path.stem)
                        try:
                            with image_path.open('rb') as image_file:
                                image_django_file = File(image_file, name=image_path.name)
                                if label_path:
                                    with label_path.open('rb') as label_file:
                                        label_django_file = File(label_file, name=label_path.name)
                                        created.append(
                                            _create_training_item(
                                                pipeline,
                                                image_django_file,
                                                label_file=label_django_file,
                                                image_name=image_path.name,
                                                label_name=label_path.name,
                                            )
                                        )
                                else:
                                    created.append(
                                        _create_training_item(
                                            pipeline,
                                            image_django_file,
                                            image_name=image_path.name,
                                        )
                                    )
                        except ValueError as exc:
                            return Response(
                                {'detail': str(exc)},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
        finally:
            if hasattr(archive, 'seek'):
                archive.seek(0)

        serializer = TrainingDatasetItemSerializer(
            created,
            many=True,
            context={'request': request},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'put'], url_path='split-config')
    def split_config(self, request, pk=None):
        pipeline = self.get_object()
        split_config, _ = TrainingSplitConfig.objects.get_or_create(pipeline=pipeline)
        if request.method.lower() == 'get':
            return Response(TrainingSplitConfigSerializer(split_config).data)

        serializer = TrainingSplitConfigSerializer(split_config, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(applied_at=None)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='apply-split')
    def apply_split(self, request, pk=None):
        pipeline = self.get_object()
        split_config, _ = TrainingSplitConfig.objects.get_or_create(pipeline=pipeline)
        serializer = TrainingSplitConfigSerializer(
            split_config,
            data=request.data or {},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        split_config = serializer.save(applied_at=timezone.now())

        items = list(pipeline.items.all().order_by('id'))
        rng = random.Random(split_config.seed)
        rng.shuffle(items)
        total = len(items)
        train_count = int(total * split_config.train_percent / 100)
        val_count = int(total * split_config.val_percent / 100)

        for index, item in enumerate(items):
            if index < train_count:
                item.split = TrainingDatasetItem.SPLIT_TRAIN
            elif index < train_count + val_count:
                item.split = TrainingDatasetItem.SPLIT_VAL
            else:
                item.split = TrainingDatasetItem.SPLIT_TEST
        TrainingDatasetItem.objects.bulk_update(items, ['split'])
        return Response({
            'split_config': TrainingSplitConfigSerializer(split_config).data,
            'train_count': train_count,
            'val_count': val_count,
            'test_count': total - train_count - val_count,
        })

    @action(detail=True, methods=['get', 'post'], url_path='configs')
    def configs(self, request, pk=None):
        pipeline = self.get_object()
        if request.method.lower() == 'get':
            serializer = TrainingConfigSerializer(
                pipeline.configs.all().order_by('-created_at'),
                many=True,
            )
            return Response(serializer.data)

        serializer = TrainingConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            config = TrainingConfig.objects.create(
                pipeline=pipeline,
                **serializer.validated_data,
            )
        except IntegrityError:
            return Response(
                {'detail': 'Configuration name must be unique within this pipeline.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            TrainingConfigSerializer(config).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'], url_path='jobs')
    def jobs(self, request, pk=None):
        pipeline = self.get_object()
        if request.method.lower() == 'get':
            serializer = TrainingJobSerializer(
                pipeline.jobs.select_related('config')
                .prefetch_related('artifacts')
                .all()
                .order_by('-queued_at'),
                many=True,
                context={'request': request},
            )
            return Response(serializer.data)

        serializer = TrainingJobSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = serializer.validated_data['config']
        if config.pipeline_id != pipeline.id:
            return Response(
                {'detail': 'Training configuration does not belong to this pipeline.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        split_counts = pipeline.items.values('split').annotate(count=Count('id'))
        counts_by_split = {item['split']: item['count'] for item in split_counts}
        if counts_by_split.get(TrainingDatasetItem.SPLIT_UNASSIGNED, 0):
            return Response(
                {'detail': 'Apply train/validation/test split before starting training.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if counts_by_split.get(TrainingDatasetItem.SPLIT_TRAIN, 0) == 0:
            return Response(
                {'detail': 'Training split has no train images.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if counts_by_split.get(TrainingDatasetItem.SPLIT_VAL, 0) == 0:
            return Response(
                {'detail': 'Training split has no validation images.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        job = TrainingJob.objects.create(
            pipeline=pipeline,
            config=config,
            total_epochs=int((config.args or {}).get('epochs') or 0),
            final_args={
                'model': config.base_model,
                **(config.args or {}),
            },
        )
        return Response(TrainingJobSerializer(job).data, status=status.HTTP_201_CREATED)


class TrainingDatasetClassViewSet(
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = TrainingDatasetClass.objects.select_related('pipeline').all()
    serializer_class = TrainingDatasetClassSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'update': MANAGE_TRAINING_ROLES,
        'partial_update': MANAGE_TRAINING_ROLES,
        'destroy': MANAGE_TRAINING_ROLES,
    }

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {'detail': 'Class name or index must be unique.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def partial_update(self, request, *args, **kwargs):
        try:
            return super().partial_update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {'detail': 'Class name or index must be unique.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class TrainingDatasetItemViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = TrainingDatasetItem.objects.select_related('pipeline').all()
    serializer_class = TrainingDatasetItemSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'destroy': MANAGE_TRAINING_ROLES,
    }


class TrainingJobViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = (
        TrainingJob.objects.select_related('pipeline', 'config')
        .prefetch_related('artifacts')
        .all()
    )
    serializer_class = TrainingJobSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'retrieve': ALL_PROJECT_ROLES,
        'artifacts': ALL_PROJECT_ROLES,
        'download_artifacts_zip': ALL_PROJECT_ROLES,
    }

    @action(detail=True, methods=['get'], url_path='artifacts')
    def artifacts(self, request, pk=None):
        job = self.get_object()
        serializer = TrainingArtifactSerializer(
            job.artifacts.all(),
            many=True,
            context={'request': request},
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='artifacts/download-zip')
    def download_artifacts_zip(self, request, pk=None):
        job = self.get_object()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
            used_names = set()
            run_dir = Path(job.run_dir) if job.run_dir else None
            if run_dir and run_dir.exists() and run_dir.is_dir():
                for source_path in sorted(run_dir.rglob('*')):
                    if not source_path.is_file():
                        continue
                    archive_name = str(source_path.relative_to(run_dir))
                    used_names.add(archive_name)
                    archive.write(source_path, archive_name)

            if not used_names:
                artifacts = list(job.artifacts.all().order_by('artifact_type', 'id'))
                for artifact in artifacts:
                    try:
                        artifact_file = _open_artifact_file(artifact)
                    except Http404:
                        continue
                    with artifact_file:
                        base_name = _artifact_download_name(artifact)
                        archive_name = f'{artifact.artifact_type}/{base_name}'
                        if archive_name in used_names:
                            stem, suffix = os.path.splitext(base_name)
                            archive_name = f'{artifact.artifact_type}/{stem}-{artifact.id}{suffix}'
                        used_names.add(archive_name)
                        archive.writestr(archive_name, artifact_file.read())

        if not used_names:
            return Response(
                {'detail': 'No artifact files are available for this training job.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = (
            f'attachment; filename="training-job-{job.id}-artifacts.zip"'
        )
        return response


class TrainingArtifactViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = TrainingArtifact.objects.select_related('job', 'job__pipeline').all()
    serializer_class = TrainingArtifactSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'retrieve': ALL_PROJECT_ROLES,
        'download': ALL_PROJECT_ROLES,
    }

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        artifact = self.get_object()
        artifact_file = _open_artifact_file(artifact)
        response = FileResponse(
            artifact_file,
            as_attachment=True,
            filename=_artifact_download_name(artifact),
        )
        return response
