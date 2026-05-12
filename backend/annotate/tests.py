import zipfile
from io import BytesIO
from unittest import mock

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.test import RequestFactory, TestCase, override_settings

from .annotate import run_auto_annotation
from .models import (
    AIModel,
    Annotation,
    AutoAnnotateClassMapping,
    AutoAnnotateConfig,
    Image,
    Job,
    Project,
    ProjectClass,
)
from .serializers import ImageSerializer
from .views import build_yolo_export


class NoPathMemoryStorage(Storage):
    files = {}

    def _open(self, name, mode='rb'):
        return ContentFile(self.files.get(name, b''), name=name)

    def _save(self, name, content):
        self.files[name] = content.read()
        return name

    def exists(self, name):
        return name in self.files

    def url(self, name):
        return f'http://storage.test/{name}'

    def path(self, name):
        raise NotImplementedError('Remote storage does not expose local paths.')


REMOTE_STORAGE_SETTINGS = {
    'default': {
        'BACKEND': 'annotate.tests.NoPathMemoryStorage',
    },
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}


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


class AutoAnnotateStorageTests(TestCase):
    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS)
    def test_auto_annotate_reads_model_and_images_from_storage_without_local_paths(self):
        NoPathMemoryStorage.files = {
            'models/model.pt': b'model',
            'projects/1/jobs/1/images/image.jpg': b'image',
        }
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        project_class = ProjectClass.objects.create(project=project, name='Item', index=0)
        image = Image.objects.create(
            job=job,
            file='projects/1/jobs/1/images/image.jpg',
            width=100,
            height=100,
        )
        ai_model = AIModel.objects.create(
            name='Model',
            file='models/model.pt',
            classes=['Item'],
        )
        config = AutoAnnotateConfig.objects.create(project=project, model=ai_model)
        AutoAnnotateClassMapping.objects.create(
            config=config,
            model_class=0,
            project_class=project_class,
        )

        fake_boxes = mock.Mock()
        fake_boxes.cls.tolist.return_value = [0]
        fake_boxes.xyxy.tolist.return_value = [[10, 20, 80, 90]]
        fake_result = mock.Mock(boxes=fake_boxes)
        fake_model = mock.Mock()
        fake_model.predict.return_value = [fake_result]

        with mock.patch('annotate.annotate.YOLO', return_value=fake_model) as yolo:
            result = run_auto_annotation(job, config)

        self.assertEqual(result, {'images_processed': 1, 'annotations_created': 1})
        yolo.assert_called_once()
        self.assertNotEqual(yolo.call_args.args[0], 'models/model.pt')
        self.assertNotEqual(fake_model.predict.call_args.kwargs['source'], image.file.name)
        self.assertTrue(Annotation.objects.filter(image=image, project_class=project_class).exists())

    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS)
    def test_yolo_export_reads_images_from_storage_without_local_paths(self):
        NoPathMemoryStorage.files = {
            'projects/1/jobs/1/images/image.jpg': b'image-content',
        }
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        project_class = ProjectClass.objects.create(project=project, name='Item', index=0)
        image = Image.objects.create(
            job=job,
            file='projects/1/jobs/1/images/image.jpg',
            width=100,
            height=100,
        )
        Annotation.objects.create(
            image=image,
            project_class=project_class,
            x_min=10,
            y_min=20,
            x_max=80,
            y_max=90,
        )

        response = build_yolo_export(project, [image], 'project-1')

        archive = zipfile.ZipFile(BytesIO(response.content))
        self.assertEqual(
            archive.read('images/image.jpg'),
            b'image-content',
        )
        self.assertIn('labels/image.txt', archive.namelist())
