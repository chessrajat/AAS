from django.core.management.base import BaseCommand, CommandError

import socket

from train.models import TrainingJob
from train.runner import claim_next_training_job, run_training_job


class Command(BaseCommand):
    help = 'Run pending YOLO training jobs from the training queue.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=1,
            help='Maximum number of pending jobs to run. Defaults to 1.',
        )
        parser.add_argument(
            '--job-id',
            type=int,
            default=None,
            help='Run a specific pending training job.',
        )
        parser.add_argument(
            '--worker-id',
            default=None,
            help='Worker id to store on claimed jobs.',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        if limit < 1:
            raise CommandError('--limit must be at least 1.')

        worker_id = options['worker_id'] or f'{socket.gethostname()}:{id(self)}'
        job_id = options['job_id']
        ran_count = 0

        for _ in range(limit):
            job = claim_next_training_job(worker_id=worker_id, job_id=job_id)
            if not job:
                if ran_count == 0:
                    self.stdout.write(self.style.WARNING('No pending training jobs found.'))
                break

            self.stdout.write(f'Running training job #{job.id}...')
            try:
                run_training_job(job)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f'Training job #{job.id} failed: {exc}'))
            else:
                self.stdout.write(self.style.SUCCESS(f'Training job #{job.id} completed.'))

            ran_count += 1
            if job_id is not None:
                break

        running_jobs = TrainingJob.objects.filter(status=TrainingJob.STATUS_RUNNING).count()
        self.stdout.write(f'Ran {ran_count} job(s). {running_jobs} job(s) currently running.')
