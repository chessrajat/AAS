from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import annotate.models


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
