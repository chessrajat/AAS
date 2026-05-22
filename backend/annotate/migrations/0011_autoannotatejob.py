import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('annotate', '0010_projectmembership_project_members_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='AutoAnnotateJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('queued_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('total_images', models.PositiveIntegerField(default=0)),
                ('processed_images', models.PositiveIntegerField(default=0)),
                ('annotations_created', models.PositiveIntegerField(default=0)),
                ('progress_percent', models.FloatField(default=0)),
                ('worker_id', models.CharField(blank=True, max_length=100)),
                ('locked_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
                ('config', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='jobs', to='annotate.autoannotateconfig')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='auto_annotate_jobs', to='annotate.job')),
            ],
            options={
                'ordering': ['-queued_at'],
            },
        ),
        migrations.AddIndex(
            model_name='autoannotatejob',
            index=models.Index(fields=['status', 'queued_at'], name='annotate_au_status_780eed_idx'),
        ),
        migrations.AddIndex(
            model_name='autoannotatejob',
            index=models.Index(fields=['worker_id', 'locked_at'], name='annotate_au_worker__90676f_idx'),
        ),
    ]
