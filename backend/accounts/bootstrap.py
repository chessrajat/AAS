from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.utils import OperationalError, ProgrammingError


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
