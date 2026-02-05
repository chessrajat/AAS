from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    data = response.data
    error_message = None
    if isinstance(data, dict):
        if "detail" in data:
            error_message = data["detail"]
        elif "error" in data:
            error_message = data["error"]

    if not error_message:
        error_message = "Request failed"

    response.data = {
        "error": error_message,
        "details": data,
        "status_code": response.status_code,
    }
    return response
