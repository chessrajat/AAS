from rest_framework.permissions import BasePermission

from accounts.models import UserProfile


ALL_PROJECT_ROLES = {
    UserProfile.Role.OWNER,
    UserProfile.Role.MANAGER,
    UserProfile.Role.ANNOTATOR,
    UserProfile.Role.VIEWER,
}


class HasAnnotateRolePermission(BasePermission):
    """
    ViewSet-level role permission based on action and HTTP method.

    Resolution order:
    1) "<action>:<method>" (e.g. "upload_images:GET")
    2) "<action>" (e.g. "create")
    3) "default"
    """

    message = "You do not have permission to perform this action."

    def _get_role(self, user):
        if not user or not user.is_authenticated:
            return None
        if user.is_superuser:
            return UserProfile.Role.ADMIN
        profile = getattr(user, "profile", None)
        if not profile:
            return UserProfile.Role.VIEWER
        return profile.role

    def _is_allowed(self, request, view):
        role_permissions = getattr(view, "role_permissions", {})
        if not role_permissions:
            return True

        role = self._get_role(request.user)
        if role is None:
            return False
        if role == UserProfile.Role.ADMIN:
            return True

        action = getattr(view, "action", None) or ""
        method = (request.method or "").upper()
        key = f"{action}:{method}"

        allowed_roles = role_permissions.get(key)
        if allowed_roles is None:
            allowed_roles = role_permissions.get(action)
        if allowed_roles is None:
            allowed_roles = role_permissions.get("default")
        if allowed_roles is None:
            return True

        return role in allowed_roles

    def has_permission(self, request, view):
        return self._is_allowed(request, view)

    def has_object_permission(self, request, view, obj):
        return self._is_allowed(request, view)
