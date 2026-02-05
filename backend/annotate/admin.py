from django.contrib import admin

from .models import Annotation, Image, Project, ProjectClass


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


@admin.register(ProjectClass)
class ProjectClassAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'project')
    list_filter = ('project',)
    search_fields = ('name',)


@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'file', 'status')
    list_filter = ('project', 'status')
    search_fields = ('file',)


@admin.register(Annotation)
class AnnotationAdmin(admin.ModelAdmin):
    list_display = ('id', 'image', 'project_class', 'x_min', 'y_min', 'x_max', 'y_max')
    list_filter = ('project_class',)
