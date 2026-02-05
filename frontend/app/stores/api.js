"use client";

import axios from "axios";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const tokenStorageKey = "aas-auth";
const refreshClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const getStoredTokens = () => {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }
  const raw = window.localStorage.getItem(tokenStorageKey);
  if (!raw) {
    return { accessToken: null, refreshToken: null };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed?.state?.accessToken || null,
      refreshToken: parsed?.state?.refreshToken || null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
};

const setStoredAccessToken = (accessToken) => {
  if (typeof window === "undefined") {
    return;
  }
  const raw = window.localStorage.getItem(tokenStorageKey);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const next = {
      ...parsed,
      state: {
        ...(parsed?.state || {}),
        accessToken,
      },
    };
    window.localStorage.setItem(tokenStorageKey, JSON.stringify(next));
  } catch {
    return;
  }
};

const clearStoredTokens = () => {
  if (typeof window === "undefined") {
    return;
  }
  const raw = window.localStorage.getItem(tokenStorageKey);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const next = {
      ...parsed,
      state: {
        ...(parsed?.state || {}),
        accessToken: null,
        refreshToken: null,
      },
    };
    window.localStorage.setItem(tokenStorageKey, JSON.stringify(next));
  } catch {
    return;
  }
};

const redirectToLogin = () => {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
};

let isRefreshing = false;
let pendingRequests = [];

const processPending = (token) => {
  pendingRequests.forEach((callback) => callback(token));
  pendingRequests = [];
};

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getStoredTokens();
  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    const { refreshToken } = getStoredTokens();
    if (!refreshToken) {
      clearStoredTokens();
      redirectToLogin();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          };
          resolve(apiClient(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const response = await refreshClient.post("/api/auth/token/refresh/", {
        refresh: refreshToken,
      });
      const newAccessToken = response.data?.access;
      if (!newAccessToken) {
        throw new Error("Missing access token");
      }
      setStoredAccessToken(newAccessToken);
      apiClient.defaults.headers.Authorization = `Bearer ${newAccessToken}`;
      processPending(newAccessToken);
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newAccessToken}`,
      };
      return apiClient(originalRequest);
    } catch (refreshError) {
      processPending(null);
      clearStoredTokens();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
