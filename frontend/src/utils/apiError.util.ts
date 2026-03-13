import { isAxiosError, AxiosError } from "axios";

type ApiErrorCode = "BACKEND_ERROR" | "NETWORK_ERROR" | "UNKNOWN_ERROR";

type ApiErrorData = {
  message?: string;
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;

  constructor(message: string, code: ApiErrorCode, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function handleApiError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorData>;
    if (axiosError.response?.data?.message) {
      return new ApiError(
        axiosError.response.data.message,
        "BACKEND_ERROR",
        axiosError.response.status || 400,
      );
    } else if (!axiosError.response) {
      return new ApiError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR",
        503,
      );
    } else {
      return new ApiError(
        axiosError.message || "An unexpected error occurred. Please try again later.",
        "UNKNOWN_ERROR",
        axiosError.response.status || 500,
      );
    }
  }
  const message = error instanceof Error ? error.message : "Non-axios error occurred.";
  return new ApiError(message, "UNKNOWN_ERROR", 500);
}

export { handleApiError };
