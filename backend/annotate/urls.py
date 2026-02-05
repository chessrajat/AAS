from rest_framework.routers import DefaultRouter

from .views import AnnotationViewSet, ImageViewSet, ProjectClassViewSet, ProjectViewSet

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')
router.register('images', ImageViewSet, basename='image')
router.register('annotations', AnnotationViewSet, basename='annotation')
router.register('classes', ProjectClassViewSet, basename='project-class')

# Endpoints:
# - /api/annotate/projects/ [GET, POST]
# - /api/annotate/projects/{id}/ [GET, PUT, PATCH, DELETE]
# - /api/annotate/projects/{id}/images/ [GET, POST]
# - /api/annotate/projects/{id}/classes/ [POST]
# - /api/annotate/images/{id}/annotations/ [GET, POST]
# - /api/annotate/annotations/{id}/ [PATCH, DELETE]
# - /api/annotate/classes/{id}/ [DELETE]
urlpatterns = router.urls
