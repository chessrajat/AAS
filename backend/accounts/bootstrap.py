from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.utils import OperationalError, ProgrammingError

from .models import UserProfile


def ensure_default_user() -> None:
    username = getattr(settings, 'DEFAULT_ADMIN_USERNAME', None)
    password = getattr(settings, 'DEFAULT_ADMIN_PASSWORD', None)
    email = getattr(settings, 'DEFAULT_ADMIN_EMAIL', '') or ''
    if not username or not password:
        return

    User = get_user_model()
    try:
        if User.objects.filter(username=username).exists():
            return
        User.objects.create_superuser(
            username=username,
            password=password,
            email=email,
        )
    except (OperationalError, ProgrammingError):
        # Database isn't ready (migrations not applied yet).
        return


def ensure_user_profiles() -> None:
    User = get_user_model()
    try:
        users = User.objects.all()
        for user in users:
            default_role = (
                UserProfile.Role.ADMIN if user.is_superuser else UserProfile.Role.VIEWER
            )
            profile, created = UserProfile.objects.get_or_create(
                user=user,
                defaults={'role': default_role},
            )
            if not created and user.is_superuser and profile.role != UserProfile.Role.ADMIN:
                profile.role = UserProfile.Role.ADMIN
                profile.save(update_fields=['role'])
    except (OperationalError, ProgrammingError):
        return
