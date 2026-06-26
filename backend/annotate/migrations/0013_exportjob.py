import django.db.models.deletion

from django.db import migrations, models
import annotate.models


class Migration(migrations.Migration):

    dependencies = [
        ('annotate', '0012_auto_annotate_mode'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('export_type', models.CharField(choices=[('yolo', 'YOLO')], default='yolo', max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('queued_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('total_images', models.PositiveIntegerField(default=0)),
                ('processed_images', models.PositiveIntegerField(default=0)),
                ('progress_percent', models.FloatField(default=0)),
                ('file', models.FileField(blank=True, upload_to=annotate.models.export_file_upload_to)),
                ('worker_id', models.CharField(blank=True, max_length=100)),
                ('locked_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='export_jobs', to='annotate.job')),
            ],
            options={
                'ordering': ['-queued_at'],
            },
        ),
        migrations.AddIndex(
            model_name='exportjob',
            index=models.Index(fields=['status', 'queued_at'], name='annotate_ex_status_c7e70a_idx'),
        ),
        migrations.AddIndex(
            model_name='exportjob',
            index=models.Index(fields=['worker_id', 'locked_at'], name='annotate_ex_worker__e26779_idx'),
        ),
    ]
