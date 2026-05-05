import os

from storages.backends.s3boto3 import S3Boto3Storage


class MinioMediaStorage(S3Boto3Storage):
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME', 'aas-media')
    location = os.getenv('AWS_MEDIA_LOCATION', 'media')
    file_overwrite = False


class MinioStaticStorage(S3Boto3Storage):
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME', 'aas-media')
    location = os.getenv('AWS_STATIC_LOCATION', 'static')
    file_overwrite = True
