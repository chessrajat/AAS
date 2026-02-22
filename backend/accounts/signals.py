from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .bootstrap import ensure_default_user


@receiver(post_migrate)
def create_default_admin_after_migrate(sender, **kwargs):
    app_config = kwargs.get('app_config')
    if not app_config or app_config.name != 'accounts':
        return
    ensure_default_user()
