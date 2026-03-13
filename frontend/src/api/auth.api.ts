import { api } from "@/lib/axios.config";
import type { LoginRequest, AuthData, AuthResponse, RegisterRequest, User } from "@/types/auth.type";
import { handleApiError } from "@/utils/apiError.util";

async function loginUser(credentials: LoginRequest): Promise<AuthData> {
  try {
    const response: AuthResponse<AuthData> = await api.post("/auth/login", credentials);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

async function registerUser(credentials: RegisterRequest): Promise<User> {
  try {
    const response: AuthResponse<User> = await api.post("/auth/register", credentials);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

async function getCurrentUser(): Promise<User> {
  try {
    const response: AuthResponse<{ user: User }> = await api.get("/auth/me");
    return response.data.user;
  } catch (error) {
    throw handleApiError(error);
  }
}

export { loginUser, registerUser, getCurrentUser };
