from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import annotate.models


def assign_existing_images_to_default_jobs(apps, schema_editor):
    Project = apps.get_model('annotate', 'Project')
    Job = apps.get_model('annotate', 'Job')
    Image = apps.get_model('annotate', 'Image')

    for project in Project.objects.filter(images__job__isnull=True).distinct():
        job, _ = Job.objects.get_or_create(
            project=project,
            name='Imported images',
            defaults={'description': 'Images migrated from the project-level annotation workflow.'},
        )
        Image.objects.filter(project=project, job__isnull=True).update(job=job)


def unassign_default_jobs(apps, schema_editor):
    Image = apps.get_model('annotate', 'Image')
    Image.objects.update(job=None)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('annotate', '0008_auto_annotate_mapping_model_class_int'),
    ]

    operations = [
        migrations.CreateModel(
            name='Job',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('new', 'New'), ('in_progress', 'In progress'), ('done', 'Done')], default='new', max_length=20)),
                ('assignees', models.ManyToManyField(blank=True, related_name='annotation_jobs', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_annotation_jobs', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='jobs', to='annotate.project')),
            ],
        ),
        migrations.AddConstraint(
            model_name='job',
            constraint=models.UniqueConstraint(fields=('project', 'name'), name='unique_project_job_name'),
        ),
        migrations.AddField(
            model_name='image',
            name='job',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='images', to='annotate.job'),
        ),
        migrations.RunPython(assign_existing_images_to_default_jobs, unassign_default_jobs),
        migrations.RemoveField(
            model_name='image',
            name='project',
        ),
        migrations.AlterField(
            model_name='image',
            name='file',
            field=models.ImageField(upload_to=annotate.models.project_image_upload_to),
        ),
        migrations.AlterField(
            model_name='image',
            name='job',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='annotate.job'),
        ),
    ]
