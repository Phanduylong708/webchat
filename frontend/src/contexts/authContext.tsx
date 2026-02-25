import React, { createContext } from "react";
import type {
  AuthContextType,
  User,
  LoginRequest,
  RegisterRequest,
} from "@/types/auth.type";
import { removeToken, saveToken, getToken } from "@/utils/localStorage.util";
import { loginUser, registerUser, getCurrentUser } from "@/api/auth.api";
import { queryClient } from "../lib/queryClient";

const AuthContext = createContext<AuthContextType | undefined>(undefined);
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  function setCurrentUser(nextUser: User): void {
    setUser(nextUser);
  }

  function logout(): void {
    setUser(null);
    setError(null);
    removeToken();
    void queryClient.cancelQueries();
    queryClient.clear();
  }

  async function login(credentials: LoginRequest): Promise<boolean> {
    try {
      setLoading(true);
      setError(null);
      const data = await loginUser(credentials);
      setUser(data.user);
      saveToken(data.token);
      return true; //for navigation after successful login
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(caughtError.message || "Login failed. Please try again.");
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function register(credentials: RegisterRequest): Promise<boolean> {
    try {
      setLoading(true);
      setError(null);
      await registerUser(credentials);
      return true; //for navigation after successful registration
    } catch (err) {
      const caughtError = err as {
        message: string;
        code: string;
        status: number;
      };
      setError(caughtError.message || "Registration failed. Please try again.");
      return false;
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
  const value = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    checkAuth,
    setCurrentUser,
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

export { AuthContext, AuthProvider };
