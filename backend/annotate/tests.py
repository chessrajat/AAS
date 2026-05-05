from django.test import RequestFactory, TestCase, override_settings

from .models import Image, Job, Project
from .serializers import ImageSerializer


class ImageSerializerStorageTests(TestCase):
    @override_settings(
        USE_S3_STORAGE=True,
        AWS_ACCESS_KEY_ID='aasminio',
        AWS_SECRET_ACCESS_KEY='aasminio123',
        AWS_STORAGE_BUCKET_NAME='aas-media',
        AWS_S3_ENDPOINT_URL='http://minio:9000',
        AWS_S3_PUBLIC_ENDPOINT_URL='http://localhost:9000',
        AWS_S3_REGION_NAME='us-east-1',
        AWS_S3_ADDRESSING_STYLE='path',
        AWS_QUERYSTRING_AUTH=False,
        AWS_S3_CUSTOM_DOMAIN='localhost:9000/aas-media',
        AWS_S3_URL_PROTOCOL='http:',
        MEDIA_URL='http://localhost:9000/aas-media/media/',
        STORAGES={
            'default': {
                'BACKEND': 'aas.storage.MinioMediaStorage',
            },
            'staticfiles': {
                'BACKEND': 'aas.storage.MinioStaticStorage',
            },
        },
    )
    def test_file_url_uses_storage_url_without_rewriting_to_backend_media(self):
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        image = Image.objects.create(
            job=job,
            file='projects/1/jobs/1/images/example.jpg',
            width=100,
            height=100,
        )
        request = RequestFactory().get('/api/annotate/jobs/1/images/')

        data = ImageSerializer(image, context={'request': request}).data

        self.assertEqual(
            data['file_url'],
            'http://localhost:9000/aas-media/media/projects/1/jobs/1/images/example.jpg',
        )
