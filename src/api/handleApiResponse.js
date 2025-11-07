export function handleApiResponse(response) {
  const data = response.data;
  if (data.success) {
    return {
      success: true,
      data: data.data,
      message: data.message,
      status: data.status,
    };
  } else {
    // ApiResponse<T> with success: false or ApiError<T>
    let errorMsg = data.message || data.title || "Request failed";
    let errorDetails = [];
    if (Array.isArray(data.errors)) {
      errorDetails = data.errors;
    } else if (data.errors && typeof data.errors === "object") {
      errorDetails = Object.values(data.errors).flat();
    }
    return {
      success: false,
      error: errorMsg,
      errorDetails,
      status: data.status || data.Status,
    };
  }
}

// Extract a human-friendly error message from an Axios error or response-like object
// Preference order: title -> message -> first errors[]/errors[field][0] -> detail -> fallback to err.message
export function extractApiErrorMessage(err) {
  try {
    if (!err) return "Request failed";
    const resp = err.response;
    const data = resp?.data;
    if (data && typeof data === "object") {
      const title = data.title || data.message || data.error || null;
      let detail = null;
      if (Array.isArray(data.errors)) {
        if (data.errors.length) detail = data.errors[0];
      } else if (data.errors && typeof data.errors === "object") {
        const firstKey = Object.keys(data.errors)[0];
        const arr = firstKey ? data.errors[firstKey] : null;
        if (Array.isArray(arr) && arr.length) detail = arr[0];
      }
      if (!detail && typeof data.detail === "string" && data.detail) {
        detail = data.detail;
      }
      if (title && detail) return `${title}: ${detail}`;
      if (title) return title;
      if (detail) return detail;
    }
    if (typeof err.message === "string" && err.message) {
      // Hide generic Axios phrasing when possible
      const generic = /Request failed with status code (\d+)/i.exec(
        err.message
      );
      if (generic && resp?.status) {
        return `Request failed (${resp.status})`;
      }
      return err.message;
    }
    return "Request failed";
  } catch {
    return "Request failed";
  }
}
