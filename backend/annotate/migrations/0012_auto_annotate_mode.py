from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('annotate', '0011_autoannotatejob'),
    ]

    operations = [
        migrations.AddField(
            model_name='autoannotateconfig',
            name='mode',
            field=models.CharField(
                choices=[
                    ('skip', 'Skip existing classes'),
                    ('override', 'Override annotations'),
                ],
                default='skip',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='autoannotatejob',
            name='mode',
            field=models.CharField(
                choices=[
                    ('skip', 'Skip existing classes'),
                    ('override', 'Override annotations'),
                ],
                default='skip',
                max_length=20,
            ),
        ),
    ]
