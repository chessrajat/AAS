from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')

# Endpoints:
# - /api/annotate/projects/ [GET, POST]
# - /api/annotate/projects/{id}/ [GET, PUT, PATCH, DELETE]
# - /api/annotate/projects/{id}/images/ [GET, POST]
urlpatterns = router.urls
