from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _normalize_detail(detail):
    if isinstance(detail, list):
        return [_normalize_detail(item) for item in detail]
    if isinstance(detail, dict):
        return {key: _normalize_detail(value) for key, value in detail.items()}
    return str(detail)


def _first_error_message(detail):
    if isinstance(detail, list):
        for item in detail:
            message = _first_error_message(item)
            if message:
                return message
        return None

    if isinstance(detail, dict):
        if "non_field_errors" in detail:
            message = _first_error_message(detail["non_field_errors"])
            if message:
                return message
        for value in detail.values():
            message = _first_error_message(value)
            if message:
                return message
        return None

    if detail in (None, ""):
        return None
    return str(detail)


def _error_code_for_status(status_code):
    if status_code == status.HTTP_400_BAD_REQUEST:
        return "bad_request"
    if status_code == status.HTTP_401_UNAUTHORIZED:
        return "unauthorized"
    if status_code == status.HTTP_403_FORBIDDEN:
        return "forbidden"
    if status_code == status.HTTP_404_NOT_FOUND:
        return "not_found"
    if status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
        return "method_not_allowed"
    if status_code == status.HTTP_409_CONFLICT:
        return "conflict"
    if status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
        return "unprocessable_entity"
    if status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        return "rate_limited"
    if 500 <= status_code:
        return "server_error"
    return "request_failed"


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {
                "success": False,
                "error": {
                    "code": "server_error",
                    "message": "Internal server error.",
                    "details": None,
                },
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = _normalize_detail(response.data)
    message = _first_error_message(detail) or "Request failed."
    response.data = {
        "success": False,
        "error": {
            "code": _error_code_for_status(response.status_code),
            "message": message,
            "details": detail,
        },
        "status_code": response.status_code,
    }
    return response
