from rest_framework.routers import DefaultRouter

from .views import (
    TrainingDatasetClassViewSet,
    TrainingDatasetItemViewSet,
    TrainingJobViewSet,
    TrainingPipelineViewSet,
)

router = DefaultRouter()
router.register('pipelines', TrainingPipelineViewSet, basename='training-pipeline')
router.register('classes', TrainingDatasetClassViewSet, basename='training-class')
router.register('items', TrainingDatasetItemViewSet, basename='training-item')
router.register('jobs', TrainingJobViewSet, basename='training-job')

urlpatterns = router.urls
