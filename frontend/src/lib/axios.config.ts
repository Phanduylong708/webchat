import axios from "axios";
import { getToken } from "@/utils/localStorage.util";

const PORT = import.meta.env.VITE_API_BASE_URL || 5000
const api = axios.create({
    baseURL: `http://localhost:${PORT}/api`
})

api.interceptors.request.use(function (config) {
    const token = getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

