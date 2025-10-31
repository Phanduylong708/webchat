import { isAxiosError, AxiosError } from "axios";

export type FormattedError = {
    message: string;
    code: "BACKEND_ERROR" | "NETWORK_ERROR" | "UNKNOWN_ERROR";
    status: number;
}

type ApiErrorData = {
    message?: string;
};

function handleApiError(error: unknown): FormattedError {
    if (isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiErrorData>;
        if (axiosError.response?.data?.message) { // backend provided an error message.
            return {
                message: axiosError.response.data.message,
                code: "BACKEND_ERROR",
                status: axiosError.response.status || 400,
            };
        }
        else if (!axiosError.response) { // no response received
            return {
                message: "Network error. Please check your connection.",
                code: "NETWORK_ERROR",
                status: 503,
            };
        }
        else { // other axios errors 404 HTML, 500, etc.
            return {
                message: axiosError.message || "An unexpected error occurred. Please try again later.",
                code: "UNKNOWN_ERROR",
                status: axiosError.response.status || 500,
            };
        }
    }
    // non-axios errors
    const message = (error instanceof Error) ? error.message : "Non-axios error occurred.";
    return {
        message,
        code: "UNKNOWN_ERROR",
        status: 500,
    };
}

export { handleApiError };