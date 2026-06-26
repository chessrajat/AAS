import socket

from django.db import transaction
from django.utils import timezone

from .annotate import run_auto_annotation
from .models import AutoAnnotateJob


def claim_next_auto_annotate_job(worker_id=None):
    worker_id = worker_id or f'{socket.gethostname()}'
    with transaction.atomic():
        job = (
            AutoAnnotateJob.objects.select_for_update()
            .filter(status=AutoAnnotateJob.STATUS_PENDING)
            .order_by('queued_at')
            .first()
        )
        if not job:
            return None

        job.status = AutoAnnotateJob.STATUS_RUNNING
        job.started_at = timezone.now()
        job.locked_at = timezone.now()
        job.worker_id = worker_id
        job.error_message = ''
        job.save(update_fields=[
            'status',
            'started_at',
            'locked_at',
            'worker_id',
            'error_message',
        ])
        return job


def run_auto_annotate_job(auto_annotate_job):
    auto_annotate_job = AutoAnnotateJob.objects.select_related(
        'job',
        'job__project',
        'config',
        'config__model',
    ).get(id=auto_annotate_job.id)
    try:
        def update_progress(processed_images, total_images, annotations_created):
            auto_annotate_job.total_images = total_images
            auto_annotate_job.processed_images = processed_images
            auto_annotate_job.annotations_created = annotations_created
            auto_annotate_job.progress_percent = (
                processed_images / total_images * 100
            ) if total_images else 0
            auto_annotate_job.save(update_fields=[
                'total_images',
                'processed_images',
                'annotations_created',
                'progress_percent',
            ])

        result = run_auto_annotation(
            auto_annotate_job.job,
            auto_annotate_job.config,
            mode=auto_annotate_job.mode,
            progress_callback=update_progress,
        )
        processed_images = int(result.get('images_processed') or 0)
        annotations_created = int(result.get('annotations_created') or 0)
        total_images = auto_annotate_job.total_images or auto_annotate_job.job.images.count()

        auto_annotate_job.status = AutoAnnotateJob.STATUS_COMPLETED
        auto_annotate_job.finished_at = timezone.now()
        auto_annotate_job.total_images = total_images
        auto_annotate_job.processed_images = processed_images
        auto_annotate_job.annotations_created = annotations_created
        auto_annotate_job.progress_percent = 100
        auto_annotate_job.save(update_fields=[
            'status',
            'finished_at',
            'total_images',
            'processed_images',
            'annotations_created',
            'progress_percent',
        ])
        return auto_annotate_job
    except Exception as exc:
        auto_annotate_job.status = AutoAnnotateJob.STATUS_FAILED
        auto_annotate_job.finished_at = timezone.now()
        auto_annotate_job.error_message = str(exc)
        auto_annotate_job.save(update_fields=['status', 'finished_at', 'error_message'])
        raise


def run_next_auto_annotate_job(worker_id=None):
    auto_annotate_job = claim_next_auto_annotate_job(worker_id=worker_id)
    if not auto_annotate_job:
        return False
    run_auto_annotate_job(auto_annotate_job)
    return True
