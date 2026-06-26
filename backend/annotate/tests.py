import zipfile
from io import BytesIO
from unittest import mock

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from rest_framework.test import APIClient

from .annotate import run_auto_annotation
from .models import (
    AIModel,
    Annotation,
    AutoAnnotateJob,
    AutoAnnotateClassMapping,
    AutoAnnotateConfig,
    ExportJob,
    Image,
    Job,
    Project,
    ProjectClass,
)
from .serializers import ImageSerializer
from .views import build_yolo_export
from .runner import run_export_job

User = get_user_model()


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
        AWS_S3_PROXY_URLS='True',
        AWS_S3_REGION_NAME='us-east-1',
        AWS_S3_ADDRESSING_STYLE='path',
        AWS_QUERYSTRING_AUTH=False,
        MEDIA_URL='/media/',
        STORAGES={
            'default': {
                'BACKEND': 'aas.storage.MinioMediaStorage',
            },
            'staticfiles': {
                'BACKEND': 'aas.storage.MinioStaticStorage',
            },
        },
    )
    def test_file_url_uses_proxy_media_url_with_request_host(self):
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
            'http://testserver/media/projects/1/jobs/1/images/example.jpg',
        )


class AutoAnnotateStorageTests(TestCase):
    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS, YOLO_DEVICE='0')
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
        self.assertEqual(fake_model.predict.call_args.kwargs['device'], '0')
        self.assertTrue(Annotation.objects.filter(image=image, project_class=project_class).exists())
        image.refresh_from_db()
        self.assertEqual(image.status, Image.STATUS_NEW)

    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS)
    def test_auto_annotate_skip_mode_keeps_existing_class_annotations(self):
        NoPathMemoryStorage.files = {
            'models/model.pt': b'model',
            'projects/1/jobs/1/images/image.jpg': b'image',
        }
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        existing_class = ProjectClass.objects.create(project=project, name='Existing', index=0)
        new_class = ProjectClass.objects.create(project=project, name='New', index=1)
        image = Image.objects.create(
            job=job,
            file='projects/1/jobs/1/images/image.jpg',
            width=100,
            height=100,
        )
        existing_annotation = Annotation.objects.create(
            image=image,
            project_class=existing_class,
            x_min=1,
            y_min=2,
            x_max=20,
            y_max=30,
        )
        ai_model = AIModel.objects.create(
            name='Model',
            file='models/model.pt',
            classes=['Existing', 'New'],
        )
        config = AutoAnnotateConfig.objects.create(
            project=project,
            model=ai_model,
            mode=AutoAnnotateConfig.MODE_SKIP,
        )
        AutoAnnotateClassMapping.objects.create(
            config=config,
            model_class=0,
            project_class=existing_class,
        )
        AutoAnnotateClassMapping.objects.create(
            config=config,
            model_class=1,
            project_class=new_class,
        )
        fake_boxes = mock.Mock()
        fake_boxes.cls.tolist.return_value = [0, 1]
        fake_boxes.xyxy.tolist.return_value = [[10, 20, 80, 90], [30, 40, 70, 95]]
        fake_result = mock.Mock(boxes=fake_boxes)
        fake_model = mock.Mock()
        fake_model.predict.return_value = [fake_result]

        with mock.patch('annotate.annotate.YOLO', return_value=fake_model):
            result = run_auto_annotation(job, config, mode=AutoAnnotateConfig.MODE_SKIP)

        self.assertEqual(result, {'images_processed': 1, 'annotations_created': 1})
        existing_annotation.refresh_from_db()
        self.assertEqual(existing_annotation.x_min, 1)
        self.assertTrue(Annotation.objects.filter(image=image, project_class=new_class).exists())
        self.assertEqual(Annotation.objects.filter(image=image, project_class=existing_class).count(), 1)

    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS)
    def test_auto_annotate_override_mode_replaces_existing_annotations(self):
        NoPathMemoryStorage.files = {
            'models/model.pt': b'model',
            'projects/1/jobs/1/images/image.jpg': b'image',
        }
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        existing_class = ProjectClass.objects.create(project=project, name='Existing', index=0)
        image = Image.objects.create(
            job=job,
            file='projects/1/jobs/1/images/image.jpg',
            width=100,
            height=100,
        )
        Annotation.objects.create(
            image=image,
            project_class=existing_class,
            x_min=1,
            y_min=2,
            x_max=20,
            y_max=30,
        )
        ai_model = AIModel.objects.create(
            name='Model',
            file='models/model.pt',
            classes=['Existing'],
        )
        config = AutoAnnotateConfig.objects.create(
            project=project,
            model=ai_model,
            mode=AutoAnnotateConfig.MODE_OVERRIDE,
        )
        AutoAnnotateClassMapping.objects.create(
            config=config,
            model_class=0,
            project_class=existing_class,
        )
        fake_boxes = mock.Mock()
        fake_boxes.cls.tolist.return_value = [0]
        fake_boxes.xyxy.tolist.return_value = [[10, 20, 80, 90]]
        fake_result = mock.Mock(boxes=fake_boxes)
        fake_model = mock.Mock()
        fake_model.predict.return_value = [fake_result]

        with mock.patch('annotate.annotate.YOLO', return_value=fake_model):
            result = run_auto_annotation(job, config, mode=AutoAnnotateConfig.MODE_OVERRIDE)

        annotation = Annotation.objects.get(image=image, project_class=existing_class)
        self.assertEqual(result, {'images_processed': 1, 'annotations_created': 1})
        self.assertEqual(annotation.x_min, 10)

    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS)
    def test_auto_annotate_reports_progress_after_each_processed_image(self):
        NoPathMemoryStorage.files = {
            'models/model.pt': b'model',
            'projects/1/jobs/1/images/image.jpg': b'image',
        }
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        project_class = ProjectClass.objects.create(project=project, name='Item', index=0)
        Image.objects.create(
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
        fake_result = mock.Mock(boxes=None)
        fake_model = mock.Mock()
        fake_model.predict.return_value = [fake_result]
        progress_events = []

        with mock.patch('annotate.annotate.YOLO', return_value=fake_model):
            run_auto_annotation(
                job,
                config,
                progress_callback=lambda processed, total, annotations: progress_events.append(
                    (processed, total, annotations)
                ),
            )

        self.assertEqual(progress_events, [(1, 1, 0)])

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


class AutoAnnotateQueueTests(TestCase):
    def test_auto_annotate_run_enqueues_job_without_running_inline(self):
        user = User.objects.create_superuser(
            username='queue-admin',
            email='admin@example.com',
            password='password',
        )
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        ai_model = AIModel.objects.create(
            name='Model',
            file='models/model.pt',
            classes=['Item'],
        )
        AutoAnnotateConfig.objects.create(
            project=project,
            model=ai_model,
            mode=AutoAnnotateConfig.MODE_OVERRIDE,
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(f'/api/annotate/jobs/{job.id}/auto-annotate/run/', {})

        self.assertEqual(response.status_code, 202)
        queued_job = AutoAnnotateJob.objects.get()
        self.assertEqual(queued_job.job, job)
        self.assertEqual(queued_job.config.model, ai_model)
        self.assertEqual(queued_job.mode, AutoAnnotateConfig.MODE_OVERRIDE)
        self.assertEqual(queued_job.status, AutoAnnotateJob.STATUS_PENDING)
        self.assertEqual(response.data['id'], queued_job.id)

    def test_auto_annotate_run_enqueues_requested_model_config(self):
        user = User.objects.create_superuser(
            username='model-admin',
            email='model-admin@example.com',
            password='password',
        )
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        first_model = AIModel.objects.create(
            name='First model',
            file='models/first.pt',
            classes=['First'],
        )
        second_model = AIModel.objects.create(
            name='Second model',
            file='models/second.pt',
            classes=['Second'],
        )
        AutoAnnotateConfig.objects.create(project=project, model=first_model)
        second_config = AutoAnnotateConfig.objects.create(
            project=project,
            model=second_model,
            mode=AutoAnnotateConfig.MODE_SKIP,
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            f'/api/annotate/jobs/{job.id}/auto-annotate/run/',
            {'model_id': second_model.id},
            format='json',
        )

        self.assertEqual(response.status_code, 202)
        queued_job = AutoAnnotateJob.objects.get()
        self.assertEqual(queued_job.config, second_config)
        self.assertEqual(queued_job.mode, AutoAnnotateConfig.MODE_SKIP)

    def test_auto_annotate_job_status_endpoint_returns_progress(self):
        user = User.objects.create_superuser(
            username='status-admin',
            email='status-admin@example.com',
            password='password',
        )
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        ai_model = AIModel.objects.create(
            name='Model',
            file='models/model.pt',
            classes=['Item'],
        )
        config = AutoAnnotateConfig.objects.create(project=project, model=ai_model)
        auto_job = AutoAnnotateJob.objects.create(
            job=job,
            config=config,
            status=AutoAnnotateJob.STATUS_RUNNING,
            total_images=10,
            processed_images=4,
            annotations_created=7,
            progress_percent=40,
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get(
            f'/api/annotate/jobs/{job.id}/auto-annotate/jobs/{auto_job.id}/',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], auto_job.id)
        self.assertEqual(response.data['status'], AutoAnnotateJob.STATUS_RUNNING)


class ExportQueueTests(TestCase):
    def test_job_export_endpoint_enqueues_export_job(self):
        user = User.objects.create_superuser(
            username='export-admin',
            email='export-admin@example.com',
            password='password',
        )
        project = Project.objects.create(name='Project')
        job = Job.objects.create(project=project, name='Job')
        Image.objects.create(
            job=job,
            file='projects/1/jobs/1/images/image.jpg',
            width=100,
            height=100,
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(f'/api/annotate/jobs/{job.id}/exports/', {})

        self.assertEqual(response.status_code, 202)
        export_job = ExportJob.objects.get()
        self.assertEqual(export_job.job, job)
        self.assertEqual(export_job.status, ExportJob.STATUS_PENDING)
        self.assertEqual(export_job.total_images, 1)

    @override_settings(STORAGES=REMOTE_STORAGE_SETTINGS)
    def test_export_worker_saves_zip_to_storage(self):
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
        export_job = ExportJob.objects.create(job=job, total_images=1)

        run_export_job(export_job)

        export_job.refresh_from_db()
        self.assertEqual(export_job.status, ExportJob.STATUS_COMPLETED)
        self.assertEqual(export_job.progress_percent, 100)
        self.assertTrue(export_job.file.name)
        archive = zipfile.ZipFile(BytesIO(NoPathMemoryStorage.files[export_job.file.name]))
        self.assertEqual(archive.read('images/image.jpg'), b'image-content')
        self.assertIn('labels/image.txt', archive.namelist())
        self.assertEqual(response.data['processed_images'], 4)
        self.assertEqual(response.data['total_images'], 10)
        self.assertEqual(response.data['annotations_created'], 7)
        self.assertEqual(response.data['progress_percent'], 40)
