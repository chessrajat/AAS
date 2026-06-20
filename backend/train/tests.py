from pathlib import Path
from unittest import mock

from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings

from .management.commands.run_training_jobs import Command
from .models import TrainingArtifact, TrainingConfig, TrainingJob, TrainingPipeline
from .runner import _copy_field_file, _store_artifact, run_training_job


class StorageFile:
    def __init__(self, content):
        self._content = content
        self.name = 'remote/file.txt'

    @property
    def path(self):
        raise NotImplementedError('Remote storage does not expose local paths.')

    def open(self, mode='rb'):
        return ContentFile(self._content)

    def chunks(self):
        yield self._content


class TrainingRunnerStorageTests(TestCase):
    @override_settings(MEDIA_ROOT='/tmp/aas-test-media')
    def test_copy_field_file_reads_from_storage_without_local_path(self):
        destination = Path('/tmp/aas-test-media/copied/file.txt')

        _copy_field_file(StorageFile(b'from storage'), destination)

        self.assertEqual(destination.read_bytes(), b'from storage')
        destination.unlink()

    def test_store_artifact_saves_through_model_file_field_storage(self):
        pipeline = TrainingPipeline.objects.create(name='pipe')
        config = TrainingConfig.objects.create(pipeline=pipeline, name='config')
        job = TrainingJob.objects.create(pipeline=pipeline, config=config)
        source = Path('/tmp/aas-artifact-source.txt')
        source.write_text('artifact-content', encoding='utf-8')

        artifact = _store_artifact(job, TrainingArtifact.TYPE_LOG, source)

        self.assertIsNotNone(artifact)
        self.assertEqual(artifact.artifact_type, TrainingArtifact.TYPE_LOG)
        with artifact.file.open('rb') as artifact_file:
            self.assertEqual(artifact_file.read(), b'artifact-content')
        source.unlink()

    @override_settings(YOLO_DEVICE='0')
    def test_run_training_job_passes_configured_yolo_device(self):
        pipeline = TrainingPipeline.objects.create(name='pipe')
        config = TrainingConfig.objects.create(
            pipeline=pipeline,
            name='config',
            args={'epochs': 1},
        )
        job = TrainingJob.objects.create(pipeline=pipeline, config=config)
        fake_model = mock.Mock()
        fake_model.train.return_value = mock.Mock(save_dir=None)
        fake_model.trainer = mock.Mock(save_dir=None)

        with (
            mock.patch(
                'train.runner.materialize_yolo_dataset',
                return_value=(Path('/tmp/aas-dataset'), Path('/tmp/aas-dataset/data.yaml')),
            ),
            mock.patch('train.runner._resolve_base_model', return_value='yolo11n.pt'),
            mock.patch('train.runner.YOLO', return_value=fake_model),
        ):
            run_training_job(job)

        self.assertEqual(fake_model.train.call_args.kwargs['device'], '0')


class TrainingWorkerCommandTests(SimpleTestCase):
    def test_worker_runs_auto_annotate_before_training(self):
        command = Command()
        options = {
            'limit': 1,
            'job_id': None,
            'worker_id': 'worker-1',
            'loop': False,
            'poll_interval': 0,
        }

        with (
            mock.patch(
                'train.management.commands.run_training_jobs.run_next_auto_annotate_job',
                return_value=True,
            ) as run_auto,
            mock.patch(
                'train.management.commands.run_training_jobs.claim_next_training_job',
            ) as claim_training,
            mock.patch(
                'train.management.commands.run_training_jobs.TrainingJob.objects.filter',
            ) as training_filter,
        ):
            training_filter.return_value.count.return_value = 0

            command.handle(**options)

        run_auto.assert_called_once_with(worker_id='worker-1')
        claim_training.assert_not_called()

    def test_worker_continues_when_auto_annotate_job_fails(self):
        command = Command()
        options = {
            'limit': 1,
            'job_id': None,
            'worker_id': 'worker-1',
            'loop': False,
            'poll_interval': 0,
        }

        with (
            mock.patch(
                'train.management.commands.run_training_jobs.run_next_auto_annotate_job',
                side_effect=Exception('auto failed'),
            ),
            mock.patch(
                'train.management.commands.run_training_jobs.claim_next_training_job',
                return_value=None,
            ),
            mock.patch(
                'train.management.commands.run_training_jobs.TrainingJob.objects.filter',
            ) as training_filter,
        ):
            training_filter.return_value.count.return_value = 0

            command.handle(**options)

    def test_loop_mode_keeps_polling_until_interrupted(self):
        command = Command()
        options = {
            'limit': 1,
            'job_id': None,
            'worker_id': 'worker-1',
            'loop': True,
            'poll_interval': 0,
        }

        with (
            mock.patch(
                'train.management.commands.run_training_jobs.run_next_auto_annotate_job',
                return_value=False,
            ),
            mock.patch('train.management.commands.run_training_jobs.claim_next_training_job') as claim,
            mock.patch('train.management.commands.run_training_jobs.run_training_job'),
            mock.patch('train.management.commands.run_training_jobs.TrainingJob.objects.filter') as training_filter,
            mock.patch('train.management.commands.run_training_jobs.time.sleep') as sleep,
        ):
            claim.side_effect = [None, KeyboardInterrupt]
            training_filter.return_value.count.return_value = 0

            command.handle(**options)

        self.assertEqual(claim.call_count, 2)
        sleep.assert_called_once_with(0)
