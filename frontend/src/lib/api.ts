import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

// Request interceptor: attach token from localStorage as Bearer header
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("pw_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle 401 and 403 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const status = error.response?.status;
    const isAuthPage = window.location.pathname.startsWith("/auth");

    // 401 — access token missing or invalid
    if (status === 401 && !isAuthPage) {
      localStorage.removeItem("pw_auth");
      localStorage.removeItem("pw_token");
      window.location.href = "/auth/login";
    }

    // 403 on a refresh attempt — token was already used (replay) or expired
    if (status === 403 && error.config?._isRefreshAttempt) {
      localStorage.removeItem("pw_auth");
      localStorage.removeItem("pw_token");
      window.location.href = "/auth/login";
    }

    return Promise.reject(error);
  },
);

export default api;
