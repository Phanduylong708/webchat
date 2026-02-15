import { api } from "@/lib/axios.config";
import type { AuthResponse, User } from "@/types/auth.type";

async function uploadMyAvatarApi(file: File): Promise<User> {
  try {
    const formData = new FormData();
    formData.append("avatar", file);

    const response: AuthResponse<{ user: User }> = await api.post(
      "/users/me/avatar",
      formData
    );

    return response.data.user;
  } catch (error) {
    const caughtError = error as {
      response?: { data?: { message?: string }; status?: number };
    };
    if (caughtError.response?.data?.message) {
      throw {
        message: caughtError.response.data.message,
        code: "BACKEND_ERROR",
        status: caughtError.response.status || 400,
      };
    } else if (!caughtError.response) {
      throw {
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
        status: 503,
      };
    } else {
      throw {
        message: "An unexpected error occurred. Please try again later.",
        code: "UNKNOWN_ERROR",
        status: caughtError.response.status || 500,
      };
    }
  }
}

export { uploadMyAvatarApi };
