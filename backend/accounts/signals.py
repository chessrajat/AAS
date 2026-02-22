from django.contrib.auth import get_user_model
from django.db.models.signals import post_migrate
from django.db.models.signals import post_save
from django.dispatch import receiver

from .bootstrap import ensure_default_user, ensure_user_profiles
from .models import UserProfile

User = get_user_model()


@receiver(post_migrate)
def create_default_admin_after_migrate(sender, **kwargs):
    app_config = kwargs.get('app_config')
    if not app_config or app_config.name != 'accounts':
        return
    ensure_default_user()
    ensure_user_profiles()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, **kwargs):
    default_role = (
        UserProfile.Role.ADMIN if instance.is_superuser else UserProfile.Role.VIEWER
    )
    profile, created = UserProfile.objects.get_or_create(
        user=instance,
        defaults={'role': default_role},
    )
    if not created and instance.is_superuser and profile.role != UserProfile.Role.ADMIN:
        profile.role = UserProfile.Role.ADMIN
        profile.save(update_fields=['role'])
