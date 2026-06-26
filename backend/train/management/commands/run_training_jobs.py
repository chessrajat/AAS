from django.core.management.base import BaseCommand, CommandError

import socket
import time

from annotate.runner import (
    recover_stale_auto_annotate_jobs,
    recover_stale_export_jobs,
    run_next_auto_annotate_job,
    run_next_export_job,
)
from train.models import TrainingJob
from train.runner import claim_next_training_job, recover_stale_training_jobs, run_training_job


class Command(BaseCommand):
    help = 'Run pending export, auto-annotate, and YOLO training jobs from the queue.'

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
        parser.add_argument(
            '--loop',
            action='store_true',
            help='Keep polling for pending jobs instead of exiting after one batch.',
        )
        parser.add_argument(
            '--poll-interval',
            type=float,
            default=5,
            help='Seconds to wait between polling attempts in loop mode.',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        if limit < 1:
            raise CommandError('--limit must be at least 1.')
        if options['poll_interval'] < 0:
            raise CommandError('--poll-interval cannot be negative.')

        worker_id = options['worker_id'] or f'{socket.gethostname()}:{id(self)}'
        job_id = options['job_id']
        loop = options['loop']
        poll_interval = options['poll_interval']

        while True:
            try:
                ran_count = self._run_batch(limit, worker_id, job_id)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('Training worker stopped.'))
                break
            running_jobs = TrainingJob.objects.filter(status=TrainingJob.STATUS_RUNNING).count()
            self.stdout.write(f'Ran {ran_count} job(s). {running_jobs} job(s) currently running.')

            if not loop or job_id is not None:
                break

            try:
                time.sleep(poll_interval)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('Training worker stopped.'))
                break

    def _run_batch(self, limit, worker_id, job_id):
        recover_stale_auto_annotate_jobs()
        recover_stale_export_jobs()
        recover_stale_training_jobs()
        ran_count = 0
        for _ in range(limit):
            try:
                ran_auto_annotate_job = run_next_auto_annotate_job(worker_id=worker_id)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f'Auto-annotate job failed: {exc}'))
                ran_count += 1
                continue

            if ran_auto_annotate_job:
                self.stdout.write(self.style.SUCCESS('Auto-annotate job completed.'))
                ran_count += 1
                continue

            try:
                ran_export_job = run_next_export_job(worker_id=worker_id)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f'Export job failed: {exc}'))
                ran_count += 1
                continue

            if ran_export_job:
                self.stdout.write(self.style.SUCCESS('Export job completed.'))
                ran_count += 1
                continue

            job = claim_next_training_job(worker_id=worker_id, job_id=job_id)
            if not job:
                if ran_count == 0:
                    self.stdout.write(self.style.WARNING('No pending ML jobs found.'))
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
        return ran_count
