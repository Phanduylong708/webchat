import { api } from "@/lib/axios.config";
import type { AuthResponse, User } from "@/types/auth.type";
import { handleApiError } from "@/utils/apiError.util";

async function uploadMyAvatarApi(file: File): Promise<User> {
  try {
    const formData = new FormData();
    formData.append("avatar", file);

    const response: AuthResponse<{ user: User }> = await api.post("/users/me/avatar", formData);
    return response.data.user;
  } catch (error) {
    throw handleApiError(error);
  }
}

export { uploadMyAvatarApi };
