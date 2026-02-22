from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from .permissions import IsAdminRole
from .serializers import UserManagementSerializer

User = get_user_model()


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {'detail': 'Invalid refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class UserManagementViewSet(ModelViewSet):
    queryset = User.objects.select_related('profile').all().order_by('id')
    serializer_class = UserManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
