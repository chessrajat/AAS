from PIL import Image as PilImage, UnidentifiedImageError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import random

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from accounts.models import UserProfile
from annotate.permissions import ALL_PROJECT_ROLES, HasAnnotateRolePermission

from .models import (
    TrainingConfig,
    TrainingDatasetClass,
    TrainingDatasetItem,
    TrainingJob,
    TrainingPipeline,
    TrainingSplitConfig,
)
from .serializers import (
    TrainingConfigSerializer,
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

        labels_by_stem = {
            label.name.rsplit('.', 1)[0]: label
            for label in labels
        }
        created = []
        with transaction.atomic():
            for image_file in images:
                image_stem = image_file.name.rsplit('.', 1)[0]
                label_file = labels_by_stem.get(image_stem)
                validation_errors = []
                try:
                    with PilImage.open(image_file) as opened_image:
                        width, height = opened_image.size
                except (UnidentifiedImageError, OSError):
                    return Response(
                        {'detail': f'Invalid image file: {image_file.name}.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if label_file is None:
                    validation_errors.append('Matching label file not found.')

                image_file.seek(0)
                if label_file is not None and hasattr(label_file, 'seek'):
                    label_file.seek(0)

                created.append(
                    TrainingDatasetItem.objects.create(
                        pipeline=pipeline,
                        image=image_file,
                        label=label_file,
                        original_image_name=image_file.name,
                        original_label_name=label_file.name if label_file else '',
                        width=width,
                        height=height,
                        validation_errors=validation_errors,
                    )
                )
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
                pipeline.jobs.select_related('config').all().order_by('-queued_at'),
                many=True,
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
    queryset = TrainingJob.objects.select_related('pipeline', 'config').all()
    serializer_class = TrainingJobSerializer
    permission_classes = [IsAuthenticated, HasAnnotateRolePermission]
    role_permissions = {
        'retrieve': ALL_PROJECT_ROLES,
    }
