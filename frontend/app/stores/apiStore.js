"use client";

import { create } from "zustand";
import { apiClient, uploadClient } from "./api";


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
  uploadProjectImages: async (projectId, files) => {
    set({ error: null });
    if (!projectId || !files || files.length === 0) {
      return { ok: false, error: "No images selected" };
    }
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });

      const response = await uploadClient.post(
        `/api/annotate/projects/${projectId}/images/`,
        formData,
      );
      const data = response.data;
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === Number(projectId)
            ? { ...project, images: data }
            : project,
        ),
      }));
      return { ok: true, data };
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : "Upload failed");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchProjectImages: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(
        `/api/annotate/projects/${projectId}/images/`,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (error instanceof Error ? error.message : "Unable to load images");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
}));
