import React, { createContext } from "react";
import type {
  AuthContextType,
  User,
  LoginRequest,
  RegisterRequest,
} from "@/types/auth.type";
import { removeToken, saveToken, getToken } from "@/utils/localStorage.util";
import { loginUser, registerUser, getCurrentUser } from "@/api/auth.api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  function logout(): void {
    setUser(null);
    setError(null);
    removeToken();
  }

  async function login(credentials: LoginRequest): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const data = await loginUser(credentials);
      setUser(data.user);
      saveToken(data.token);
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(caughtError.message || "Login failed. Please try again.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function register(credentials: RegisterRequest): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      await registerUser(credentials);
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(caughtError.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function checkAuth(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      if (token) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
      removeToken();
    } finally {
      setLoading(false);
    }
  }
  const value = { user, loading, error, login, logout, register, checkAuth };
  return <AuthContext value={value}>{children}</AuthContext>;
}

export { AuthContext, AuthProvider };
