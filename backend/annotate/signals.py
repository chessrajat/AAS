from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Image


@receiver(post_delete, sender=Image)
def delete_image_file(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)
