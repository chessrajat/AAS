from django.apps import AppConfig


class AnnotateConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'annotate'

    def ready(self):
        from . import signals  # noqa: F401
