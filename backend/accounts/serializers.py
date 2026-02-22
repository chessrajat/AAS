from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class UserManagementSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=UserProfile.Role.choices, required=False)
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        style={'input_type': 'password'},
    )

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
            'is_superuser',
            'role',
            'password',
        )
        read_only_fields = ('id', 'is_superuser')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['role'] = getattr(instance.profile, 'role', UserProfile.Role.VIEWER)
        return data

    def create(self, validated_data):
        role = validated_data.pop('role', UserProfile.Role.VIEWER)
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Password is required.'})

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        UserProfile.objects.update_or_create(user=user, defaults={'role': role})
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
        instance.save()

        if role is not None:
            UserProfile.objects.update_or_create(
                user=instance,
                defaults={'role': role},
            )
        return instance
