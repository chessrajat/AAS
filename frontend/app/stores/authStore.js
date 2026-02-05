"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiClient } from "./api";


export const useAuthStore = create()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post("/api/auth/token/", {
            username,
            password,
          });
          const data = response.data;
          set({
            accessToken: data.access,
            refreshToken: data.refresh,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (error) {
          const message =
            error?.response?.data?.detail ||
            (error instanceof Error ? error.message : "Login failed");
          set({ isLoading: false, error: message });
          return false;
        }
      },
      refresh: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) {
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post("/api/auth/token/refresh/", {
            refresh: refreshToken,
          });
          const data = response.data;
          set({
            accessToken: data.access,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (error) {
          set({
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            error: "Session expired",
          });
          return false;
        }
      },
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          isLoading: false,
          error: null,
        }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "aas-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
