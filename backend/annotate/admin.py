from django.contrib import admin

from .models import Annotation, Image, Job, Project, ProjectClass, ProjectMembership


class ProjectMembershipInline(admin.TabularInline):
    model = ProjectMembership
    extra = 0
    autocomplete_fields = ('user', 'assigned_by')


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)
    inlines = (ProjectMembershipInline,)


@admin.register(ProjectClass)
class ProjectClassAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'project')
    list_filter = ('project',)
    search_fields = ('name',)


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'project', 'status')
    list_filter = ('project', 'status')
    search_fields = ('name', 'project__name')
    filter_horizontal = ('assignees',)


@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'job', 'file', 'status')
    list_filter = ('job__project', 'job', 'status')
    search_fields = ('file',)


@admin.register(Annotation)
class AnnotationAdmin(admin.ModelAdmin):
    list_display = ('id', 'image', 'project_class', 'x_min', 'y_min', 'x_max', 'y_max')
    list_filter = ('project_class',)
