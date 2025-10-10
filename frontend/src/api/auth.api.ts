import { api } from "@/lib/axios.config";
import type { LoginRequest, AuthData, AuthResponse, RegisterRequest,User } from "@/types/auth.type";

async function loginUser(credentials: LoginRequest): Promise<AuthData> {
  try {
    const response: AuthResponse<AuthData> = await api.post(
      "/auth/login",
      credentials
    );
    return response.data;
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
    }
    else if (!caughtError.response) {
      throw {
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
        status: 503,
      };
    }
    else {
      throw {
        message: "An unexpected error occurred. Please try again later.",
        code: "UNKNOWN_ERROR",
        status: caughtError.response.status || 500,
      };
    }
  }
}

async function registerUser(credentials: RegisterRequest): Promise<User> {
  try {
    const response: AuthResponse<User> = await api.post("/auth/register", credentials)
    return response.data
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

async function getCurrentUser(): Promise<User> {
  try {
    const response: AuthResponse<{user: User}> = await api.get("/auth/me");
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

export { loginUser, registerUser, getCurrentUser };