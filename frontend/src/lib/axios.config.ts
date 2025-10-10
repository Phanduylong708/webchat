import axios from "axios";
import { getToken, removeToken } from "@/utils/localStorage.util";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use(function (config) {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  function (response) {
    return response.data;
  },
  function (error) {
    const isAuthEndpoint = error.config?.url?.includes("/auth/login") || error.config?.url?.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      removeToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export { api };
