from rest_framework.routers import DefaultRouter

from .views import AIModelViewSet, AnnotationViewSet, ImageViewSet, JobViewSet, ProjectClassViewSet, ProjectViewSet

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')
router.register('jobs', JobViewSet, basename='job')
router.register('images', ImageViewSet, basename='image')
router.register('annotations', AnnotationViewSet, basename='annotation')
router.register('classes', ProjectClassViewSet, basename='project-class')
router.register('models', AIModelViewSet, basename='ai-model')

# Endpoints:
# - /api/annotate/projects/ [GET, POST]
# - /api/annotate/projects/{id}/ [GET, PUT, PATCH, DELETE]
# - /api/annotate/projects/{id}/jobs/ [GET, POST]
# - /api/annotate/projects/{id}/users/ [GET, PUT, PATCH]
# - /api/annotate/projects/{id}/assignable-users/ [GET]
# - /api/annotate/projects/{id}/classes/ [POST]
# - /api/annotate/projects/{id}/export/ [GET]
# - /api/annotate/projects/{id}/auto-annotate/configs/ [GET, POST]
# - /api/annotate/projects/{id}/auto-annotate/configs/{config_id}/ [PUT, PATCH, DELETE]
# - /api/annotate/jobs/{id}/images/ [GET, POST]
# - /api/annotate/jobs/{id}/export/ [GET]
# - /api/annotate/jobs/{id}/auto-annotate/run/ [POST]
# - /api/annotate/images/{id}/annotations/ [GET, POST]
# - /api/annotate/images/{id}/ [DELETE]
# - /api/annotate/annotations/{id}/ [PATCH, DELETE]
# - /api/annotate/classes/{id}/ [DELETE]
# - /api/annotate/models/ [GET, POST]
# - /api/annotate/models/{id}/ [GET, PUT, PATCH, DELETE]
urlpatterns = router.urls
