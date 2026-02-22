const firstMessage = (value) => {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item);
      if (message) {
        return message;
      }
    }
    return null;
  }
  if (typeof value === "object") {
    if (value.message && typeof value.message === "string") {
      return value.message;
    }
    if (value.non_field_errors) {
      const message = firstMessage(value.non_field_errors);
      if (message) {
        return message;
      }
    }
    for (const nested of Object.values(value)) {
      const message = firstMessage(nested);
      if (message) {
        return message;
      }
    }
  }
  return null;
};

export const getApiErrorMessage = (error, fallback = "Request failed") => {
  const data = error?.response?.data;

  const backendMessage = firstMessage(data?.error?.message);
  if (backendMessage) {
    return backendMessage;
  }

  const legacyError = firstMessage(data?.error);
  if (legacyError) {
    return legacyError;
  }

  const legacyDetail = firstMessage(data?.detail);
  if (legacyDetail) {
    return legacyDetail;
  }

  const generic = error instanceof Error ? error.message : null;
  return generic || fallback;
};
