"use client";

import { create } from "zustand";
import { apiClient } from "./api";


export const useApiStore = create((set) => ({
  projects: [],
  isLoadingProjects: false,
  isCreatingProject: false,
  error: null,
  clearError: () => set({ error: null }),
  fetchProjects: async (token) => {
    set({ isLoadingProjects: true, error: null });
    try {
      const response = await apiClient.get("/api/annotate/projects/", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = response.data;
      set({ isLoadingProjects: false, error: null, projects: data });
      return { ok: true, data };
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : "Unable to load projects");
      set({ isLoadingProjects: false, error: message });
      return { ok: false, error: message };
    }
  },
  createProject: async (payload, token) => {
    set({ isCreatingProject: true, error: null });
    try {
      const response = await apiClient.post("/api/annotate/projects/", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = response.data;
      set((state) => ({
        isCreatingProject: false,
        error: null,
        projects: [data, ...state.projects],
      }));
      return { ok: true, data };
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : "Unable to create project");
      set({ isCreatingProject: false, error: message });
      return { ok: false, error: message };
    }
  },
}));
