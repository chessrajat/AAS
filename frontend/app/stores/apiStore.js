"use client";

import { create } from "zustand";
import { apiClient, uploadClient } from "./api";
import { getApiErrorMessage } from "./errorUtils";


export const useApiStore = create((set) => ({
  projects: [],
  models: [],
  users: [],
  trainingPipelines: [],
  isLoadingProjects: false,
  isLoadingModels: false,
  isLoadingUsers: false,
  isLoadingTrainingPipelines: false,
  isCreatingProject: false,
  isCreatingModel: false,
  isCreatingTrainingPipeline: false,
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
      const message = getApiErrorMessage(error, "Unable to load projects");
      set({ isLoadingProjects: false, error: message });
      return { ok: false, error: message };
    }
  },
  fetchModels: async (token) => {
    set({ isLoadingModels: true, error: null });
    try {
      const response = await apiClient.get("/api/annotate/models/", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = response.data;
      set({ isLoadingModels: false, error: null, models: data });
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load models");
      set({ isLoadingModels: false, error: message });
      return { ok: false, error: message };
    }
  },
  fetchUsers: async (token) => {
    set({ isLoadingUsers: true, error: null });
    try {
      const response = await apiClient.get("/api/auth/users/", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = response.data;
      set({ isLoadingUsers: false, error: null, users: data });
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load users");
      set({ isLoadingUsers: false, error: message });
      return { ok: false, error: message };
    }
  },
  createUser: async (payload) => {
    set({ error: null });
    try {
      const response = await apiClient.post("/api/auth/users/", payload);
      const data = response.data;
      set((state) => ({
        users: [data, ...state.users],
      }));
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create user");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateUser: async (userId, payload) => {
    set({ error: null });
    if (!userId) {
      return { ok: false, error: "Missing user id" };
    }
    try {
      const response = await apiClient.patch(`/api/auth/users/${userId}/`, payload);
      const data = response.data;
      set((state) => ({
        users: state.users.map((user) => (user.id === userId ? data : user)),
      }));
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update user");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteUser: async (userId) => {
    set({ error: null });
    if (!userId) {
      return { ok: false, error: "Missing user id" };
    }
    try {
      await apiClient.delete(`/api/auth/users/${userId}/`);
      set((state) => ({
        users: state.users.filter((user) => user.id !== userId),
      }));
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete user");
      set({ error: message });
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
      const message = getApiErrorMessage(error, "Unable to create project");
      set({ isCreatingProject: false, error: message });
      return { ok: false, error: message };
    }
  },
  createModel: async (payload, token) => {
    set({ isCreatingModel: true, error: null });
    try {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          return;
        }
        formData.append(key, value);
      });

      const response = await uploadClient.post(
        "/api/annotate/models/",
        formData,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const data = response.data;
      set((state) => ({
        isCreatingModel: false,
        error: null,
        models: [data, ...state.models],
      }));
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create model");
      set({ isCreatingModel: false, error: message });
      return { ok: false, error: message };
    }
  },
  deleteModel: async (modelId) => {
    set({ error: null });
    if (!modelId) {
      return { ok: false, error: "Missing model id" };
    }
    try {
      await apiClient.delete(`/api/annotate/models/${modelId}/`);
      set((state) => ({
        models: state.models.filter((model) => model.id !== modelId),
      }));
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete model");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createProjectClass: async (projectId, payload) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.post(
        `/api/annotate/projects/${projectId}/classes/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create label");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteProjectClass: async (classId) => {
    set({ error: null });
    if (!classId) {
      return { ok: false, error: "Missing label id" };
    }
    try {
      await apiClient.delete(`/api/annotate/classes/${classId}/`);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete label");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchProject: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(`/api/annotate/projects/${projectId}/`);
      const data = response.data;
      set((state) => {
        const existingIndex = state.projects.findIndex(
          (project) => project.id === data.id,
        );
        if (existingIndex === -1) {
          return { projects: [...state.projects, data] };
        }
        const nextProjects = [...state.projects];
        nextProjects[existingIndex] = data;
        return { projects: nextProjects };
      });
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load project");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchProjectJobs: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(`/api/annotate/projects/${projectId}/jobs/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load jobs");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchProjectUsers: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(`/api/annotate/projects/${projectId}/users/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load project users");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchProjectAssignableUsers: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(
        `/api/annotate/projects/${projectId}/assignable-users/`,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load assignable users");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateProjectUsers: async (projectId, userIds) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.patch(`/api/annotate/projects/${projectId}/users/`, {
        user_ids: userIds,
      });
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update project users");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createProjectJob: async (projectId, payload) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.post(
        `/api/annotate/projects/${projectId}/jobs/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create job");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateJob: async (jobId, payload) => {
    set({ error: null });
    if (!jobId) {
      return { ok: false, error: "Missing job id" };
    }
    try {
      const response = await apiClient.patch(`/api/annotate/jobs/${jobId}/`, payload);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update job");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteJob: async (jobId) => {
    set({ error: null });
    if (!jobId) {
      return { ok: false, error: "Missing job id" };
    }
    try {
      await apiClient.delete(`/api/annotate/jobs/${jobId}/`);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete job");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  uploadJobImages: async (jobId, files) => {
    set({ error: null });
    if (!jobId || !files || files.length === 0) {
      return { ok: false, error: "No images selected" };
    }
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });

      const response = await uploadClient.post(
        `/api/annotate/jobs/${jobId}/images/`,
        formData,
      );
      const data = response.data;
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Upload failed");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchJobImages: async (jobId) => {
    set({ error: null });
    if (!jobId) {
      return { ok: false, error: "Missing job id" };
    }
    try {
      const response = await apiClient.get(
        `/api/annotate/jobs/${jobId}/images/`,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load images");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  exportJob: async (jobId, onProgress) => {
    set({ error: null });
    if (!jobId) {
      return { ok: false, error: "Missing job id" };
    }
    try {
      const response = await apiClient.get(
        `/api/annotate/jobs/${jobId}/export/`,
        {
          responseType: "blob",
          onDownloadProgress: (event) => {
            if (!onProgress || !event.total) {
              return;
            }
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          },
        },
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to export job");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchAnnotations: async (imageId) => {
    set({ error: null });
    if (!imageId) {
      return { ok: false, error: "Missing image id" };
    }
    try {
      const response = await apiClient.get(`/api/annotate/images/${imageId}/annotations/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load annotations");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createAnnotation: async (imageId, payload) => {
    set({ error: null });
    if (!imageId) {
      return { ok: false, error: "Missing image id" };
    }
    try {
      const response = await apiClient.post(
        `/api/annotate/images/${imageId}/annotations/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create annotation");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateAnnotation: async (annotationId, payload) => {
    set({ error: null });
    if (!annotationId) {
      return { ok: false, error: "Missing annotation id" };
    }
    try {
      const response = await apiClient.patch(
        `/api/annotate/annotations/${annotationId}/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update annotation");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteAnnotation: async (annotationId) => {
    set({ error: null });
    if (!annotationId) {
      return { ok: false, error: "Missing annotation id" };
    }
    try {
      await apiClient.delete(`/api/annotate/annotations/${annotationId}/`);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete annotation");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  exportProject: async (projectId, onProgress) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(
        `/api/annotate/projects/${projectId}/export/`,
        {
          responseType: "blob",
          onDownloadProgress: (event) => {
            if (!onProgress || !event.total) {
              return;
            }
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          },
        },
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to export project");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteImage: async (imageId) => {
    set({ error: null });
    if (!imageId) {
      return { ok: false, error: "Missing image id" };
    }
    try {
      await apiClient.delete(`/api/annotate/images/${imageId}/`);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete image");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateProject: async (projectId, payload) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.patch(`/api/annotate/projects/${projectId}/`, payload);
      const data = response.data;
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId ? data : project,
        ),
      }));
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update project");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteProject: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      await apiClient.delete(`/api/annotate/projects/${projectId}/`);
      set((state) => ({
        projects: state.projects.filter((project) => project.id !== projectId),
      }));
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete project");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchTrainingPipelines: async () => {
    set({ isLoadingTrainingPipelines: true, error: null });
    try {
      const response = await apiClient.get("/api/train/pipelines/");
      const data = response.data;
      set({ isLoadingTrainingPipelines: false, trainingPipelines: data });
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load training pipelines");
      set({ isLoadingTrainingPipelines: false, error: message });
      return { ok: false, error: message };
    }
  },
  createTrainingPipeline: async (payload) => {
    set({ isCreatingTrainingPipeline: true, error: null });
    try {
      const response = await apiClient.post("/api/train/pipelines/", payload);
      const data = response.data;
      set((state) => ({
        isCreatingTrainingPipeline: false,
        trainingPipelines: [data, ...state.trainingPipelines],
      }));
      return { ok: true, data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create training pipeline");
      set({ isCreatingTrainingPipeline: false, error: message });
      return { ok: false, error: message };
    }
  },
  fetchTrainingPipeline: async (pipelineId) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.get(`/api/train/pipelines/${pipelineId}/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load training pipeline");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createTrainingClass: async (pipelineId, payload) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.post(
        `/api/train/pipelines/${pipelineId}/classes/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create training class");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateTrainingClass: async (classId, payload) => {
    set({ error: null });
    if (!classId) {
      return { ok: false, error: "Missing class id" };
    }
    try {
      const response = await apiClient.patch(`/api/train/classes/${classId}/`, payload);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update training class");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  deleteTrainingClass: async (classId) => {
    set({ error: null });
    if (!classId) {
      return { ok: false, error: "Missing class id" };
    }
    try {
      await apiClient.delete(`/api/train/classes/${classId}/`);
      return { ok: true };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to delete training class");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  uploadTrainingItems: async (pipelineId, images, labels) => {
    set({ error: null });
    if (!pipelineId || !images || images.length === 0) {
      return { ok: false, error: "No images selected" };
    }
    try {
      const formData = new FormData();
      Array.from(images).forEach((file) => formData.append("images", file));
      Array.from(labels || []).forEach((file) => formData.append("labels", file));
      const response = await uploadClient.post(
        `/api/train/pipelines/${pipelineId}/items/upload/`,
        formData,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Upload failed");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  uploadTrainingZip: async (pipelineId, archive) => {
    set({ error: null });
    if (!pipelineId || !archive) {
      return { ok: false, error: "No ZIP archive selected" };
    }
    try {
      const formData = new FormData();
      formData.append("archive", archive);
      const response = await uploadClient.post(
        `/api/train/pipelines/${pipelineId}/items/upload-zip/`,
        formData,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "ZIP upload failed");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchTrainingItems: async (pipelineId) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.get(`/api/train/pipelines/${pipelineId}/items/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load training items");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  applyTrainingSplit: async (pipelineId, payload) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.post(
        `/api/train/pipelines/${pipelineId}/apply-split/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to apply split");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createTrainingConfig: async (pipelineId, payload) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.post(
        `/api/train/pipelines/${pipelineId}/configs/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to save training configuration");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchTrainingConfigs: async (pipelineId) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.get(`/api/train/pipelines/${pipelineId}/configs/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load training configurations");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createTrainingJob: async (pipelineId, configId) => {
    set({ error: null });
    if (!pipelineId || !configId) {
      return { ok: false, error: "Missing training configuration" };
    }
    try {
      const response = await apiClient.post(
        `/api/train/pipelines/${pipelineId}/jobs/`,
        { config: configId },
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to queue training job");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchTrainingJobs: async (pipelineId) => {
    set({ error: null });
    if (!pipelineId) {
      return { ok: false, error: "Missing pipeline id" };
    }
    try {
      const response = await apiClient.get(`/api/train/pipelines/${pipelineId}/jobs/`);
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load training jobs");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  fetchAutoAnnotateConfigs: async (projectId) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.get(
        `/api/annotate/projects/${projectId}/auto-annotate/configs/`,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to load configs");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  createAutoAnnotateConfig: async (projectId, payload) => {
    set({ error: null });
    if (!projectId) {
      return { ok: false, error: "Missing project id" };
    }
    try {
      const response = await apiClient.post(
        `/api/annotate/projects/${projectId}/auto-annotate/configs/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to save config");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  updateAutoAnnotateConfig: async (projectId, configId, payload) => {
    set({ error: null });
    if (!projectId || !configId) {
      return { ok: false, error: "Missing config id" };
    }
    try {
      const response = await apiClient.put(
        `/api/annotate/projects/${projectId}/auto-annotate/configs/${configId}/`,
        payload,
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to update config");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
  runJobAutoAnnotate: async (jobId, payload) => {
    set({ error: null });
    if (!jobId) {
      return { ok: false, error: "Missing job id" };
    }
    try {
      const response = await apiClient.post(
        `/api/annotate/jobs/${jobId}/auto-annotate/run/`,
        payload || {},
      );
      return { ok: true, data: response.data };
    } catch (error) {
      const message = getApiErrorMessage(error, "Auto-annotate failed");
      set({ error: message });
      return { ok: false, error: message };
    }
  },
}));
