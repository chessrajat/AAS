from rest_framework.permissions import BasePermission

from .models import UserProfile


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        profile = getattr(user, 'profile', None)
        return bool(profile and profile.role == UserProfile.Role.ADMIN)
