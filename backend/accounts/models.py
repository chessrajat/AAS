from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        MANAGER = 'manager', 'Manager'
        ANNOTATOR = 'annotator', 'Annotator'
        VIEWER = 'viewer', 'Viewer'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
    )

    def __str__(self) -> str:
        return f'{self.user.username} ({self.role})'
