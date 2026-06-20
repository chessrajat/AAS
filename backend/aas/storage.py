import os

from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class ProxyUrlMixin:
    def url(self, name, parameters=None, expire=None, http_method=None):
        proxy_urls = getattr(settings, 'AWS_S3_PROXY_URLS', os.getenv('AWS_S3_PROXY_URLS', 'False'))
        if str(proxy_urls).lower() in {'1', 'true', 'yes', 'on'}:
            normalized_name = name.lstrip('/')
            normalized_location = self.location.strip('/')
            if normalized_location and normalized_name.startswith(f'{normalized_location}/'):
                normalized_name = normalized_name[len(normalized_location) + 1:]
            return f'/{normalized_location}/{normalized_name}' if normalized_location else f'/{normalized_name}'
        return super().url(name, parameters=parameters, expire=expire, http_method=http_method)


class MinioMediaStorage(ProxyUrlMixin, S3Boto3Storage):
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME', 'aas-media')
    location = os.getenv('AWS_MEDIA_LOCATION', 'media')
    file_overwrite = False


class MinioStaticStorage(ProxyUrlMixin, S3Boto3Storage):
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME', 'aas-media')
    location = os.getenv('AWS_STATIC_LOCATION', 'static')
    file_overwrite = True
