from rest_framework.routers import DefaultRouter

from .views import (
    TrainingArtifactViewSet,
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
router.register('artifacts', TrainingArtifactViewSet, basename='training-artifact')

urlpatterns = router.urls
