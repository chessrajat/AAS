"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import HomeSidebar from "../../../components/HomeSidebar";
import { useAuthStore } from "../../../stores/authStore";
import { useApiStore } from "../../../stores/apiStore";
import { toast } from "sonner";
import AnnotationSidebar from "./components/AnnotationSidebar";
import AnnotationToolSidebar from "./components/AnnotationToolSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function ProjectAnnotatePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const requestedJobId = searchParams.get("jobId") || "";
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    uploadJobImages,
    fetchJobImages,
    fetchProjectJobs,
    fetchProject,
    fetchAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    createProjectClass,
    exportProject,
    exportJob,
    deleteProjectClass,
    deleteImage,
    fetchAutoAnnotateConfigs,
    fetchModels,
    models,
    createAutoAnnotateConfig,
    updateAutoAnnotateConfig,
    runJobAutoAnnotate,
    markImageDone,
  } = useApiStore();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageContainerRef = useRef(null);
  const panStartRef = useRef(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const spacePanPreviousToolRef = useRef(null);
  const isSpacePanActiveRef = useRef(false);
  const lastPointerPositionRef = useRef({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageJumpValue, setImageJumpValue] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [project, setProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [hiddenAnnotationIds, setHiddenAnnotationIds] = useState([]);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [activeTool, setActiveTool] = useState("draw");
  const [activeLabelId, setActiveLabelId] = useState(null);
  const [draftBox, setDraftBox] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizingAnnotation, setIsResizingAnnotation] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [canvasCursor, setCanvasCursor] = useState("default");
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [hasAutoAnnotateConfig, setHasAutoAnnotateConfig] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [classMappings, setClassMappings] = useState({});
  const [autoAnnotateConfigs, setAutoAnnotateConfigs] = useState([]);
  const [isSavingAutoAnnotate, setIsSavingAutoAnnotate] = useState(false);
  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false);
  const [isMarkingImageDone, setIsMarkingImageDone] = useState(false);
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [newLabelIndex, setNewLabelIndex] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isDeleteLabelOpen, setIsDeleteLabelOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState(null);
  const [isDeleteImageOpen, setIsDeleteImageOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isShortcutLabelPickerOpen, setIsShortcutLabelPickerOpen] = useState(false);
  const [imageMeta, setImageMeta] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
  });
  const minZoom = 0.5;
  const maxZoom = 3;
  const zoomStep = 0.05;
  const hasImages = images.length > 0;
  const activeJob = jobs.find((job) => String(job.id) === String(activeJobId));
  const activeImage = hasImages ? images[activeIndex] : null;
  const imageName = activeImage?.file?.split("/").pop() || "No image";
  const projectLabels = project?.classes ?? [];
  const hasLabels = projectLabels.length > 0;
  const activeLabel = projectLabels.find((label) => label.id === activeLabelId);
  const annotationCount = annotations.length;
  const hiddenAnnotationIdSet = useMemo(
    () => new Set(hiddenAnnotationIds),
    [hiddenAnnotationIds],
  );
  const keyboardShortcuts = [
    { key: "D", description: "Switch to Draw bounding box tool." },
    { key: "S", description: "Switch to Select/Move tool." },
    { key: "X", description: "Go to next image." },
    { key: "Z", description: "Go to previous image." },
    { key: "Q", description: "Delete the current image." },
    { key: "C (hold)", description: "Open label picker while drawing over an image." },
    { key: "Space (hold)", description: "Temporarily switch to Pan tool." },
    { key: "Delete", description: "Delete selected annotation." },
  ];

  const imageStatusLabels = {
    new: "New",
    in_progress: "In progress",
    done: "Done",
  };

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    }
  }, [accessToken, router]);

  useEffect(() => {
    if (!accessToken || !params?.projectId) {
      return;
    }

    let isMounted = true;
    const loadJobs = async () => {
      const result = await fetchProjectJobs(params.projectId);
      if (result.ok) {
        const nextJobs = result.data || [];
        if (!isMounted) {
          return;
        }
        setJobs(nextJobs);
        const requestedJob = nextJobs.find(
          (job) => String(job.id) === String(requestedJobId),
        );
        setActiveJobId(
          requestedJob?.id
            ? String(requestedJob.id)
            : nextJobs[0]?.id
              ? String(nextJobs[0].id)
              : "",
        );
      }
    };
    loadJobs();

    return () => {
      isMounted = false;
    };
  }, [accessToken, params?.projectId, fetchProjectJobs, requestedJobId]);

  useEffect(() => {
    if (!accessToken || !activeJobId) {
      setImages([]);
      setActiveIndex(0);
      return;
    }

    let isMounted = true;
    const loadImages = async () => {
      const result = await fetchJobImages(activeJobId);
      if (!isMounted) {
        return;
      }
      if (result.ok) {
        setImages(result.data || []);
        setActiveIndex(0);
      }
    };
    loadImages();

    return () => {
      isMounted = false;
    };
  }, [accessToken, activeJobId, fetchJobImages]);

  useEffect(() => {
    if (!hasImages) {
      setImageJumpValue("");
      return;
    }
    setImageJumpValue(String(activeIndex + 1));
  }, [activeIndex, hasImages]);

  useEffect(() => {
    setActiveLabelId(null);
    setActiveJobId("");
    setJobs([]);
    setImages([]);
  }, [params?.projectId]);

  useEffect(() => {
    if (!accessToken || !params?.projectId) {
      return;
    }

    let isMounted = true;
    const loadProject = async () => {
      setIsLoadingProject(true);
      const result = await fetchProject(params.projectId);
      if (!isMounted) {
        return;
      }
      if (result.ok) {
        setProject(result.data);
        if (result.data?.classes?.length && !activeLabelId) {
          setActiveLabelId(result.data.classes[0].id);
        }
      } else {
        toast.error("Project unavailable", {
          description: result.error || "You do not have access to this project.",
        });
        router.replace("/");
      }
      setIsLoadingProject(false);
    };
    loadProject();

    return () => {
      isMounted = false;
    };
  }, [accessToken, params?.projectId, fetchProject, activeLabelId, router]);

  useEffect(() => {
    if (!accessToken || !params?.projectId) {
      return;
    }
    let isMounted = true;
    const loadConfigs = async () => {
      const result = await fetchAutoAnnotateConfigs(params.projectId);
      if (!isMounted) {
        return;
      }
      if (result.ok) {
        setHasAutoAnnotateConfig((result.data || []).length > 0);
        setAutoAnnotateConfigs(result.data || []);
      }
    };
    loadConfigs();
    return () => {
      isMounted = false;
    };
  }, [accessToken, params?.projectId, fetchAutoAnnotateConfigs]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    fetchModels(accessToken);
  }, [accessToken, fetchModels]);

  useEffect(() => {
    if (!selectedModelId) {
      setClassMappings({});
      return;
    }
    const config = autoAnnotateConfigs.find(
      (item) => String(item.model?.id) === selectedModelId,
    );
    if (!config) {
      setClassMappings({});
      return;
    }
    const nextMappings = {};
    (config.mappings || []).forEach((mapping) => {
      nextMappings[mapping.model_class] = String(mapping.project_class);
    });
    setClassMappings(nextMappings);
  }, [selectedModelId, autoAnnotateConfigs]);

  const handleSaveAutoAnnotate = async () => {
    if (!selectedModelId) {
      toast.error("Select a model to configure.");
      return;
    }
    const mappings = Object.entries(classMappings)
      .filter(([, value]) => value)
      .map(([modelClass, projectClass]) => ({
        model_class: Number(modelClass),
        project_class: Number(projectClass),
      }));
    setIsSavingAutoAnnotate(true);
    const existingConfig = autoAnnotateConfigs.find(
      (item) => String(item.model?.id) === selectedModelId,
    );
    const payload = {
      model_id: Number(selectedModelId),
      mappings,
    };
    const result = existingConfig
      ? await updateAutoAnnotateConfig(params.projectId, existingConfig.id, payload)
      : await createAutoAnnotateConfig(params.projectId, payload);
    setIsSavingAutoAnnotate(false);
    if (!result.ok) {
      toast.error("Save failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    const updatedConfigs = existingConfig
      ? autoAnnotateConfigs.map((item) =>
          item.id === result.data.id ? result.data : item,
        )
      : [result.data, ...autoAnnotateConfigs];
    setAutoAnnotateConfigs(updatedConfigs);
    setHasAutoAnnotateConfig(updatedConfigs.length > 0);
    setIsMappingDialogOpen(false);
    toast.success("Auto-annotate configuration saved.");
  };

  const handleRunAutoAnnotate = async () => {
    if (!activeJobId) {
      toast.error("Create or select a job first.");
      return;
    }
    setIsAutoAnnotating(true);
    const result = await runJobAutoAnnotate(activeJobId);
    setIsAutoAnnotating(false);
    if (!result.ok) {
      toast.error("Auto-annotate failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Auto-annotate complete", {
      description: `${result.data?.annotations_created || 0} annotations created.`,
    });
    if (activeImage?.id) {
      const annotationsResult = await fetchAnnotations(activeImage.id);
      if (annotationsResult.ok) {
        setAnnotations(annotationsResult.data || []);
      }
    }
    const imagesResult = await fetchJobImages(activeJobId);
    if (imagesResult.ok) {
      setImages(imagesResult.data || []);
    }
  };

  useEffect(() => {
    if (!activeImage?.id) {
      setAnnotations([]);
      setHiddenAnnotationIds([]);
      return;
    }

    let isMounted = true;
    const loadAnnotations = async () => {
      setIsLoadingAnnotations(true);
      const result = await fetchAnnotations(activeImage.id);
      if (!isMounted) {
        return;
      }
      if (result.ok) {
        setAnnotations(result.data || []);
        setHiddenAnnotationIds([]);
      }
      setIsLoadingAnnotations(false);
    };
    loadAnnotations();

    return () => {
      isMounted = false;
    };
  }, [activeImage?.id, fetchAnnotations]);

  useEffect(() => {
    setImageMeta({
      naturalWidth: 0,
      naturalHeight: 0,
      displayWidth: 0,
      displayHeight: 0,
    });
  }, [activeImage?.id]);

  useEffect(() => {
    setSelectedAnnotationId(null);
    setIsDraggingAnnotation(false);
    setIsResizingAnnotation(false);
    setResizeHandle(null);
    setPanOffset({ x: 0, y: 0 });
    panOffsetRef.current = { x: 0, y: 0 };
    panStartRef.current = null;
    setIsPanning(false);
  }, [activeImage?.id]);

  useEffect(() => {
    if (activeTool === "draw") {
      setCanvasCursor("crosshair");
    } else if (activeTool === "pan") {
      setCanvasCursor("grab");
    } else {
      setCanvasCursor("default");
    }
  }, [activeTool]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useEffect(() => {
    if (activeTool !== "draw") {
      setIsShortcutLabelPickerOpen(false);
    }
  }, [activeTool]);

  const isLastPointerOverImage = () => {
    const target = canvasRef.current;
    if (!target) {
      return false;
    }
    const rect = target.getBoundingClientRect();
    const { x, y } = lastPointerPositionRef.current;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  useEffect(() => {
    if (activeTool !== "select") {
      setIsDraggingAnnotation(false);
      setIsResizingAnnotation(false);
      setResizeHandle(null);
      setSelectedAnnotationId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== "pan") {
      setIsPanning(false);
      panStartRef.current = null;
      if (activeTool === "select") {
        setCanvasCursor("default");
      }
    }
  }, [activeTool]);

  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName.toLowerCase();
      if (target.isContentEditable) {
        return true;
      }
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "c") {
        if (
          activeTool === "draw" &&
          isLastPointerOverImage() &&
          hasLabels &&
          !event.repeat
        ) {
          event.preventDefault();
          setIsShortcutLabelPickerOpen(true);
        }
        return;
      }
      if (key === "d") {
        setActiveTool("draw");
        return;
      }
      if (key === "s") {
        setActiveTool("select");
        return;
      }
      if (key === "x") {
        setActiveIndex((prev) => Math.min(prev + 1, images.length - 1));
        return;
      }
      if (key === "z") {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (key === "q") {
        if (activeImage && !isDeleteImageOpen) {
          setImageToDelete(activeImage);
          setIsDeleteImageOpen(true);
        }
        return;
      }
      if (event.code !== "Space" || event.repeat || isSpacePanActiveRef.current) {
        return;
      }

      event.preventDefault();
      spacePanPreviousToolRef.current = activeTool;
      isSpacePanActiveRef.current = true;
      setActiveTool("pan");
    };

    const handleKeyUp = (event) => {
      if (event.key.toLowerCase() === "c") {
        setIsShortcutLabelPickerOpen(false);
        return;
      }
      if (event.code !== "Space" || !isSpacePanActiveRef.current) {
        return;
      }
      event.preventDefault();
      const previousTool = spacePanPreviousToolRef.current;
      isSpacePanActiveRef.current = false;
      spacePanPreviousToolRef.current = null;
      if (previousTool) {
        setActiveTool(previousTool);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    activeTool,
    images.length,
    activeImage,
    isDeleteImageOpen,
    hasLabels,
  ]);

  useEffect(() => {
    if (!selectedAnnotationId) {
      return;
    }

    const handleKeyDown = async (event) => {
      if (event.key !== "Delete") {
        return;
      }
      const result = await deleteAnnotation(selectedAnnotationId);
      if (!result.ok) {
        toast.error("Delete failed", {
          description: result.error || "Please try again.",
        });
        return;
      }
      setAnnotations((prev) =>
        prev.filter((annotation) => annotation.id !== selectedAnnotationId),
      );
      if (activeImage?.id) {
        setImages((prev) =>
          prev.map((image) =>
            image.id === activeImage.id ? { ...image, status: "in_progress" } : image,
          ),
        );
      }
      setSelectedAnnotationId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage?.id, deleteAnnotation, selectedAnnotationId]);

  useEffect(() => {
    if (!selectedAnnotationId) {
      return;
    }
    const selected = annotations.find(
      (annotation) => annotation.id === selectedAnnotationId,
    );
    if (selected) {
      setActiveLabelId(selected.project_class);
    }
  }, [selectedAnnotationId, annotations]);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!imageMeta.naturalWidth || !imageMeta.naturalHeight) {
      return;
    }

    const handleResize = () => {
      const container = imageContainerRef.current;
      if (!container) {
        return;
      }
      const maxWidth = container.clientWidth;
      const maxHeight = container.clientHeight;
      if (!maxWidth || !maxHeight) {
        return;
      }
      const ratio = Math.min(
        maxWidth / imageMeta.naturalWidth,
        maxHeight / imageMeta.naturalHeight,
        1,
      );
      setImageMeta((prev) => ({
        ...prev,
        displayWidth: Math.round(imageMeta.naturalWidth * ratio),
        displayHeight: Math.round(imageMeta.naturalHeight * ratio),
      }));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageMeta.naturalWidth, imageMeta.naturalHeight]);

  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);

  const getImageScale = () => {
    if (!imageMeta.naturalWidth || !imageMeta.displayWidth) {
      return 1;
    }
    return imageMeta.displayWidth / imageMeta.naturalWidth;
  };

  const updateActiveImageStatus = (status) => {
    if (!activeImage?.id) {
      return;
    }
    setImages((prev) =>
      prev.map((image) =>
        image.id === activeImage.id ? { ...image, status } : image,
      ),
    );
  };

  const toDisplayBox = (annotation) => {
    const scale = getImageScale();
    return {
      x: Math.round(annotation.x_min * scale),
      y: Math.round(annotation.y_min * scale),
      w: Math.round((annotation.x_max - annotation.x_min) * scale),
      h: Math.round((annotation.y_max - annotation.y_min) * scale),
    };
  };

  const handleDeleteAnnotation = async (annotationId) => {
    const result = await deleteAnnotation(annotationId);
    if (!result.ok) {
      toast.error("Delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setAnnotations((prev) =>
      prev.filter((annotation) => annotation.id !== annotationId),
    );
    updateActiveImageStatus("in_progress");
    setHiddenAnnotationIds((prev) => prev.filter((item) => item !== annotationId));
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
  };

  const handleToggleAnnotationVisibility = (annotationId) => {
    setHiddenAnnotationIds((prev) =>
      prev.includes(annotationId)
        ? prev.filter((item) => item !== annotationId)
        : [...prev, annotationId],
    );
  };

  const handleSelectSidebarAnnotation = (annotationId) => {
    setSelectedAnnotationId(annotationId);
    setActiveTool("select");
  };

  const handleSidebarLabelClick = async (label) => {
    if (activeTool === "select" && selectedAnnotationId) {
      const selected = getAnnotationById(selectedAnnotationId);
      if (!selected) {
        return;
      }
      const payload = {
        project_class: label.id,
        x_min: selected.x_min,
        y_min: selected.y_min,
        x_max: selected.x_max,
        y_max: selected.y_max,
      };
      const result = await updateAnnotation(selectedAnnotationId, payload);
      if (!result.ok) {
        toast.error("Update failed", {
          description: result.error || "Please try again.",
        });
        return;
      }
      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === selectedAnnotationId
            ? { ...annotation, project_class: label.id }
            : annotation,
        ),
      );
      updateActiveImageStatus("in_progress");
      return;
    }
    setActiveLabelId(label.id);
  };

  const getAnnotationById = (annotationId) =>
    annotations.find((annotation) => annotation.id === annotationId);

  const getHandlePositions = (box) => ([
    { key: "nw", x: box.x, y: box.y },
    { key: "ne", x: box.x + box.w, y: box.y },
    { key: "sw", x: box.x, y: box.y + box.h },
    { key: "se", x: box.x + box.w, y: box.y + box.h },
  ]);

  const getHandleAtPosition = (pos, box) => {
    if (!pos || !box) {
      return null;
    }
    const size = 6;
    const handles = getHandlePositions(box);
    return (
      handles.find(
        (handle) =>
          Math.abs(pos.x - handle.x) <= size && Math.abs(pos.y - handle.y) <= size,
      )?.key || null
    );
  };

  const getHitAnnotation = (pos) => {
    if (!pos) {
      return null;
    }
    for (let i = annotations.length - 1; i >= 0; i -= 1) {
      const annotation = annotations[i];
      if (hiddenAnnotationIdSet.has(annotation.id)) {
        continue;
      }
      const box = toDisplayBox(annotation);
      if (
        pos.x >= box.x &&
        pos.x <= box.x + box.w &&
        pos.y >= box.y &&
        pos.y <= box.y + box.h
      ) {
        return annotation;
      }
    }
    return null;
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations.forEach((annotation) => {
      if (hiddenAnnotationIdSet.has(annotation.id)) {
        return;
      }
      const label = projectLabels.find((item) => item.id === annotation.project_class);
      const displayBox = toDisplayBox(annotation);
      const color = label?.color || "#3b82f6";
      ctx.strokeStyle = color;
      ctx.lineWidth = annotation.id === selectedAnnotationId ? 3 : 2;
      ctx.strokeRect(displayBox.x, displayBox.y, displayBox.w, displayBox.h);
    });

    if (draftBox) {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(draftBox.x, draftBox.y, draftBox.w, draftBox.h);
      ctx.setLineDash([]);
    }

    if (selectedAnnotationId) {
      const selected = getAnnotationById(selectedAnnotationId);
      if (selected && !hiddenAnnotationIdSet.has(selected.id)) {
        const displayBox = toDisplayBox(selected);
        const handles = getHandlePositions(displayBox);
        ctx.fillStyle = "#0f172a";
        handles.forEach((handle) => {
          ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
        });
      }
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [
    annotations,
    draftBox,
    imageMeta.displayWidth,
    imageMeta.displayHeight,
    projectLabels,
    selectedAnnotationId,
    hiddenAnnotationIdSet,
  ]);

  const handleUploadClick = () => {
    if (!activeJobId) {
      toast.error("Create or select a job first.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);
    const result = await uploadJobImages(activeJobId, files);
    setIsUploading(false);
    event.target.value = "";

    if (!result.ok) {
      toast.error("Upload failed", {
        description: result.error || "Please try again.",
      });
      return;
    }

    const nextImages = result.data || [];
    setImages(nextImages);
    setActiveIndex(0);
    const refreshed = await fetchJobImages(activeJobId);
    if (refreshed.ok) {
      setImages(refreshed.data || []);
    }
    const jobsResult = await fetchProjectJobs(params?.projectId);
    if (jobsResult.ok) {
      setJobs(jobsResult.data || []);
    }
    toast.success("Images uploaded", {
      description: `${files.length} image(s) added to ${activeJob?.name || "the job"}.`,
    });
  };

  const handlePrevImage = () => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNextImage = () => {
    setActiveIndex((prev) => Math.min(prev + 1, images.length - 1));
  };

  const handleImageJumpChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    setImageJumpValue(digitsOnly);
  };

  const handleImageJump = () => {
    if (!hasImages) {
      return;
    }
    const nextIndex = Number(imageJumpValue);
    if (!Number.isInteger(nextIndex) || nextIndex < 1 || nextIndex > images.length) {
      toast.error("Invalid image number", {
        description: `Enter a value between 1 and ${images.length}.`,
      });
      setImageJumpValue(String(activeIndex + 1));
      return;
    }
    setActiveIndex(nextIndex - 1);
  };

  const handleImageJumpKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    handleImageJump();
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(minZoom, Number((prev - zoomStep).toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(maxZoom, Number((prev + zoomStep).toFixed(2))));
  };

  const handleCanvasWheel = (event) => {
    if (!activeImage) {
      return;
    }

    event.preventDefault();

    const currentZoom = zoomRef.current;
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.min(
      maxZoom,
      Math.max(minZoom, Number((currentZoom + direction * zoomStep).toFixed(2))),
    );

    if (nextZoom === currentZoom) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const contentX = pointerX / currentZoom;
    const contentY = pointerY / currentZoom;
    const nextLeft = event.clientX - contentX * nextZoom;
    const nextTop = event.clientY - contentY * nextZoom;

    setPanOffset((prev) => ({
      x: prev.x + (nextLeft - rect.left),
      y: prev.y + (nextTop - rect.top),
    }));
    setZoom(nextZoom);
  };

  const handleExportProject = async () => {
    if (!params?.projectId) {
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    const result = await exportProject(params.projectId, setExportProgress);
    if (!result.ok) {
      toast.error("Export failed", {
        description: result.error || "Please try again.",
      });
      setIsExporting(false);
      return;
    }

    const blobUrl = window.URL.createObjectURL(result.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `project-${params.projectId}-yolov8.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    setIsExporting(false);
  };

  const handleExportJob = async () => {
    if (!activeJobId) {
      toast.error("Create or select a job first.");
      return;
    }
    setIsExporting(true);
    setExportProgress(0);
    const result = await exportJob(activeJobId, setExportProgress);
    if (!result.ok) {
      toast.error("Export failed", {
        description: result.error || "Please try again.",
      });
      setIsExporting(false);
      return;
    }

    const blobUrl = window.URL.createObjectURL(result.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `job-${activeJobId}-yolov8.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    setIsExporting(false);
  };

  const handleOpenDeleteLabel = (label) => {
    setLabelToDelete(label);
    setIsDeleteLabelOpen(true);
  };

  const handleConfirmDeleteLabel = async () => {
    if (!labelToDelete) {
      return;
    }
    const result = await deleteProjectClass(labelToDelete.id);
    if (!result.ok) {
      toast.error("Delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }

    setProject((prev) => {
      if (!prev) {
        return prev;
      }
      const nextClasses = (prev.classes || []).filter(
        (label) => label.id !== labelToDelete.id,
      );
      if (activeLabelId === labelToDelete.id) {
        setActiveLabelId(nextClasses[0]?.id || null);
      }
      return {
        ...prev,
        classes: nextClasses,
      };
    });
    setAnnotations((prev) =>
      prev.filter((annotation) => annotation.project_class !== labelToDelete.id),
    );
    if (selectedAnnotationId) {
      const selected = getAnnotationById(selectedAnnotationId);
      if (selected?.project_class === labelToDelete.id) {
        setSelectedAnnotationId(null);
      }
    }
    setIsDeleteLabelOpen(false);
    setLabelToDelete(null);
  };

  function handleOpenDeleteImage(image) {
    setImageToDelete(image);
    setIsDeleteImageOpen(true);
  }

  const handleConfirmDeleteImage = async () => {
    if (!imageToDelete) {
      return;
    }
    const result = await deleteImage(imageToDelete.id);
    if (!result.ok) {
      toast.error("Delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setImages((prev) => {
      const nextImages = prev.filter((image) => image.id !== imageToDelete.id);
      const nextIndex = Math.min(activeIndex, Math.max(nextImages.length - 1, 0));
      setActiveIndex(nextIndex);
      return nextImages;
    });
    setAnnotations([]);
    setIsDeleteImageOpen(false);
    setImageToDelete(null);
  };

  const handleMarkImageDone = async () => {
    if (!activeImage?.id) {
      return;
    }
    setIsMarkingImageDone(true);
    const result = await markImageDone(activeImage.id);
    setIsMarkingImageDone(false);
    if (!result.ok) {
      toast.error("Unable to mark done", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setImages((prev) =>
      prev.map((image) =>
        image.id === activeImage.id ? result.data : image,
      ),
    );
    toast.success("Image marked done.");
    setActiveIndex((prev) => Math.min(prev + 1, images.length - 1));
  };

  const openLabelDialog = () => {
    const nextIndex = projectLabels.length
      ? Math.max(...projectLabels.map((label) => label.index)) + 1
      : 0;
    setNewLabelName("");
    setNewLabelColor("#3b82f6");
    setNewLabelIndex(String(nextIndex));
    setIsLabelDialogOpen(true);
  };

  const handleSaveLabel = async () => {
    const trimmedName = newLabelName.trim();
    const parsedIndex = Number(newLabelIndex);

    if (!trimmedName) {
      toast.error("Label name is required");
      return;
    }
    if (Number.isNaN(parsedIndex) || parsedIndex < 0) {
      toast.error("Label index must be a non-negative number");
      return;
    }
    if (projectLabels.some((label) => label.name === trimmedName)) {
      toast.error("Label name must be unique");
      return;
    }
    if (projectLabels.some((label) => label.index === parsedIndex)) {
      toast.error("Label index must be unique");
      return;
    }

    setIsSavingLabel(true);
    const result = await createProjectClass(params?.projectId, {
      name: trimmedName,
      index: parsedIndex,
      color: newLabelColor || "#3b82f6",
    });
    setIsSavingLabel(false);

    if (!result.ok) {
      toast.error("Unable to add label", {
        description: result.error || "Please try again.",
      });
      return;
    }

    const createdLabel = result.data;
    setProject((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        classes: [...(prev.classes || []), createdLabel],
      };
    });
    setActiveLabelId(createdLabel?.id || null);
    setIsLabelDialogOpen(false);
  };

  const getPointerPosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;
    return { x, y };
  };

  const handleCanvasPointerDown = (event) => {
    const pos = getPointerPosition(event);
    if (!pos || !activeImage) {
      return;
    }

    if (activeTool === "pan") {
      setIsPanning(true);
      setCanvasCursor("grabbing");
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        startX: panOffsetRef.current.x,
        startY: panOffsetRef.current.y,
      };
      return;
    }

    if (activeTool === "select") {
      const selected = selectedAnnotationId
        ? getAnnotationById(selectedAnnotationId)
        : null;
      const selectedBox = selected ? toDisplayBox(selected) : null;
      const handle = selectedBox ? getHandleAtPosition(pos, selectedBox) : null;
      if (handle && selected) {
        setIsResizingAnnotation(true);
        setResizeHandle(handle);
        return;
      }

      const hit = getHitAnnotation(pos);
      if (!hit) {
        setSelectedAnnotationId(null);
        return;
      }
      const displayBox = toDisplayBox(hit);
      setSelectedAnnotationId(hit.id);
      setIsDraggingAnnotation(true);
      setDragOffset({ x: pos.x - displayBox.x, y: pos.y - displayBox.y });
      return;
    }

    if (activeTool !== "draw") {
      return;
    }
    if (!activeLabelId) {
      toast.error("Select a label first");
      return;
    }
    setIsDrawing(true);
    setDraftBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleCanvasPointerMove = (event) => {
    const pos = getPointerPosition(event);
    if (!pos) {
      return;
    }

    if (activeTool === "pan" && isPanning && panStartRef.current) {
      const start = panStartRef.current;
      setPanOffset({
        x: start.startX + (event.clientX - start.x),
        y: start.startY + (event.clientY - start.y),
      });
      setCanvasCursor("grabbing");
      return;
    }
    if (activeTool === "pan") {
      return;
    }

    if (activeTool === "select" && !isDraggingAnnotation && !isResizingAnnotation) {
      const hit = getHitAnnotation(pos);
      if (selectedAnnotationId) {
        const selected = getAnnotationById(selectedAnnotationId);
        const box = selected ? toDisplayBox(selected) : null;
        const handle = box ? getHandleAtPosition(pos, box) : null;
        if (handle) {
          const cursorMap = {
            nw: "nwse-resize",
            se: "nwse-resize",
            ne: "nesw-resize",
            sw: "nesw-resize",
          };
          setCanvasCursor(cursorMap[handle] || "default");
          return;
        }
      }
      if (hit) {
        setCanvasCursor("move");
      } else {
        setCanvasCursor("default");
      }
      return;
    }

    if (activeTool === "select" && isDraggingAnnotation && selectedAnnotationId) {
      const selected = getAnnotationById(selectedAnnotationId);
      if (
        !selected ||
        !imageMeta.naturalWidth ||
        !imageMeta.naturalHeight ||
        !imageMeta.displayWidth ||
        !imageMeta.displayHeight
      ) {
        return;
      }

      const scale = imageMeta.naturalWidth / imageMeta.displayWidth;
      const naturalWidth = selected.x_max - selected.x_min;
      const naturalHeight = selected.y_max - selected.y_min;
      const displayWidth = Math.round(naturalWidth * getImageScale());
      const displayHeight = Math.round(naturalHeight * getImageScale());
      const maxDisplayX = Math.max(0, imageMeta.displayWidth - displayWidth);
      const maxDisplayY = Math.max(0, imageMeta.displayHeight - displayHeight);
      const nextDisplayX = Math.min(
        Math.max(0, pos.x - dragOffset.x),
        maxDisplayX,
      );
      const nextDisplayY = Math.min(
        Math.max(0, pos.y - dragOffset.y),
        maxDisplayY,
      );

      const nextXMin = Math.round(nextDisplayX * scale);
      const nextYMin = Math.round(nextDisplayY * scale);
      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === selectedAnnotationId
            ? {
                ...annotation,
                x_min: nextXMin,
                y_min: nextYMin,
                x_max: nextXMin + naturalWidth,
                y_max: nextYMin + naturalHeight,
              }
            : annotation,
        ),
      );
      return;
    }

    if (activeTool === "select" && isResizingAnnotation && selectedAnnotationId) {
      const selected = getAnnotationById(selectedAnnotationId);
      if (
        !selected ||
        !resizeHandle ||
        !imageMeta.naturalWidth ||
        !imageMeta.naturalHeight ||
        !imageMeta.displayWidth ||
        !imageMeta.displayHeight
      ) {
        return;
      }

      const scale = imageMeta.naturalWidth / imageMeta.displayWidth;
      const minSize = 4;
      const box = toDisplayBox(selected);
      const nextBox = { ...box };

      if (resizeHandle.includes("n")) {
        nextBox.h = Math.max(minSize, box.y + box.h - pos.y);
        nextBox.y = Math.min(box.y + box.h - minSize, Math.max(0, pos.y));
      }
      if (resizeHandle.includes("s")) {
        nextBox.h = Math.max(minSize, pos.y - box.y);
      }
      if (resizeHandle.includes("w")) {
        nextBox.w = Math.max(minSize, box.x + box.w - pos.x);
        nextBox.x = Math.min(box.x + box.w - minSize, Math.max(0, pos.x));
      }
      if (resizeHandle.includes("e")) {
        nextBox.w = Math.max(minSize, pos.x - box.x);
      }

      nextBox.x = Math.min(
        Math.max(0, nextBox.x),
        Math.max(0, imageMeta.displayWidth - nextBox.w),
      );
      nextBox.y = Math.min(
        Math.max(0, nextBox.y),
        Math.max(0, imageMeta.displayHeight - nextBox.h),
      );

      const nextXMin = Math.round(nextBox.x * scale);
      const nextYMin = Math.round(nextBox.y * scale);
      const nextXMax = Math.round((nextBox.x + nextBox.w) * scale);
      const nextYMax = Math.round((nextBox.y + nextBox.h) * scale);

      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === selectedAnnotationId
            ? {
                ...annotation,
                x_min: nextXMin,
                y_min: nextYMin,
                x_max: nextXMax,
                y_max: nextYMax,
              }
            : annotation,
        ),
      );
      return;
    }

    if (!isDrawing || !draftBox) {
      return;
    }
    setDraftBox((prev) => ({
      ...prev,
      w: pos.x - prev.x,
      h: pos.y - prev.y,
    }));
  };

  const handleCanvasPointerUp = async () => {
    if (activeTool === "pan") {
      setIsPanning(false);
      setCanvasCursor("grab");
      return;
    }
    setCanvasCursor(activeTool === "select" ? "default" : canvasCursor);
    if (activeTool === "select" && isDraggingAnnotation && selectedAnnotationId) {
      setIsDraggingAnnotation(false);
      const selected = getAnnotationById(selectedAnnotationId);
      if (selected) {
        const payload = {
          project_class: selected.project_class,
          x_min: selected.x_min,
          y_min: selected.y_min,
          x_max: selected.x_max,
          y_max: selected.y_max,
        };
        const result = await updateAnnotation(selectedAnnotationId, payload);
        if (!result.ok) {
          toast.error("Update failed", {
            description: result.error || "Please try again.",
          });
        } else {
          updateActiveImageStatus("in_progress");
        }
      }
      return;
    }
    if (activeTool === "select" && isResizingAnnotation && selectedAnnotationId) {
      setIsResizingAnnotation(false);
      setResizeHandle(null);
      const selected = getAnnotationById(selectedAnnotationId);
      if (selected) {
        const payload = {
          project_class: selected.project_class,
          x_min: selected.x_min,
          y_min: selected.y_min,
          x_max: selected.x_max,
          y_max: selected.y_max,
        };
        const result = await updateAnnotation(selectedAnnotationId, payload);
        if (!result.ok) {
          toast.error("Update failed", {
            description: result.error || "Please try again.",
          });
        } else {
          updateActiveImageStatus("in_progress");
        }
      }
      return;
    }
    if (activeTool === "select") {
      return;
    }

    if (!isDrawing || !draftBox || !activeImage) {
      setIsDrawing(false);
      setDraftBox(null);
      return;
    }

    const normalized = {
      x: Math.min(draftBox.x, draftBox.x + draftBox.w),
      y: Math.min(draftBox.y, draftBox.y + draftBox.h),
      w: Math.abs(draftBox.w),
      h: Math.abs(draftBox.h),
    };

    setIsDrawing(false);
    setDraftBox(null);

    if (normalized.w < 4 || normalized.h < 4) {
      return;
    }

    if (
      !imageMeta.naturalWidth ||
      !imageMeta.naturalHeight ||
      !imageMeta.displayWidth ||
      !imageMeta.displayHeight
    ) {
      return;
    }

    const scale = imageMeta.naturalWidth / imageMeta.displayWidth;
    const payload = {
      project_class: activeLabelId,
      x_min: Math.max(0, Math.round(normalized.x * scale)),
      y_min: Math.max(0, Math.round(normalized.y * scale)),
      x_max: Math.min(
        imageMeta.naturalWidth,
        Math.round((normalized.x + normalized.w) * scale),
      ),
      y_max: Math.min(
        imageMeta.naturalHeight,
        Math.round((normalized.y + normalized.h) * scale),
      ),
    };

    const result = await createAnnotation(activeImage.id, payload);
    if (!result.ok) {
      toast.error("Annotation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setAnnotations((prev) => [...prev, result.data]);
    updateActiveImageStatus("in_progress");
  };

  const handleImageLoad = (event) => {
    const container = imageContainerRef.current;
    if (!container) {
      return;
    }
    const naturalWidth = event.currentTarget.naturalWidth;
    const naturalHeight = event.currentTarget.naturalHeight;
    const maxWidth = container.clientWidth;
    const maxHeight = container.clientHeight;
    if (!maxWidth || !maxHeight || !naturalWidth || !naturalHeight) {
      return;
    }
    const ratio = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
    setImageMeta({
      naturalWidth,
      naturalHeight,
      displayWidth: Math.round(naturalWidth * ratio),
      displayHeight: Math.round(naturalHeight * ratio),
    });
  };

  if (!accessToken) {
    return null;
  }

  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <div className="relative flex h-full flex-1 overflow-hidden bg-background text-foreground">
          {isExporting ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#201d1d]/40">
              <div className="rounded-sm border border-border bg-background px-6 py-5 text-center">
                <p className="text-sm font-semibold text-slate-900">Exporting dataset</p>
                <p className="mt-2 text-xs text-slate-500">
                  {exportProgress ? `${exportProgress}%` : "Preparing download..."}
                </p>
              </div>
            </div>
          ) : null}
          {isAutoAnnotating ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#201d1d]/40">
              <div className="rounded-sm border border-border bg-background px-6 py-5 text-center">
                <p className="text-sm font-semibold text-slate-900">Auto-annotating</p>
                <p className="mt-2 text-xs text-slate-500">
                  Running model on job images...
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
              Projects
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <Link
              href={`/projects/${params?.projectId}/jobs`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Jobs
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Annotation Workspace
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                {project?.name || `Project #${params?.projectId}`}
              </h1>
              <p className="text-sm text-slate-500">
                {activeJob?.name || "No job selected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <Button variant="outline" onClick={handleUploadClick} disabled={isUploading || !activeJobId}>
              {isUploading ? "Uploading..." : "Upload images"}
            </Button>
            <Button
              variant="secondary"
              disabled={!activeJobId || !hasAutoAnnotateConfig || isAutoAnnotating}
              onClick={handleRunAutoAnnotate}
            >
              Auto annotate
            </Button>
            <Button variant="outline" onClick={handleExportJob} disabled={isExporting || !activeJobId}>
              {isExporting ? "Exporting..." : "Export job"}
            </Button>
            <Button variant="outline" onClick={handleExportProject} disabled={isExporting}>
              Export project
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <AnnotationToolSidebar
            activeTool={activeTool}
            hasAutoAnnotateConfig={hasAutoAnnotateConfig}
            onConfigureAutoAnnotate={() => setIsMappingDialogOpen(true)}
            onShowShortcuts={() => setIsShortcutsDialogOpen(true)}
            onToolChange={setActiveTool}
          />
          <div className="flex flex-1 flex-col bg-muted">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <Button
                size="icon"
                variant="ghost"
                onClick={handlePrevImage}
                disabled={!hasImages || activeIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleNextImage}
                disabled={!hasImages || activeIndex === images.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2 flex items-center gap-2">
                <Badge variant="secondary">
                  {hasImages
                    ? `Image ${activeIndex + 1}/${images.length}`
                    : "No images"}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Go to</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={imageJumpValue}
                    onChange={handleImageJumpChange}
                    onKeyDown={handleImageJumpKeyDown}
                    disabled={!hasImages}
                    className="h-7 w-16 bg-background px-2 text-xs"
                    aria-label="Go to image number"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleImageJump}
                    disabled={!hasImages}
                  >
                    Go
                  </Button>
                </div>
                <span>{imageName}</span>
                {hasImages ? (
                  <Badge variant={activeImage?.status === "done" ? "default" : "outline"}>
                    {imageStatusLabels[activeImage?.status] || activeImage?.status || "New"}
                  </Badge>
                ) : null}
                {hasImages ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => handleOpenDeleteImage(activeImage)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleZoomOut}
                  disabled={!hasImages || zoom <= minZoom}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-slate-600">{zoomPercentage}%</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleZoomIn}
                  disabled={!hasImages || zoom >= maxZoom}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="relative flex h-full w-full max-w-4xl items-center justify-center rounded-sm border border-dashed border-border bg-background">
                {!hasImages ? (
                  <div className="rounded-sm border border-border bg-muted px-6 py-4 text-center text-sm text-muted-foreground">
                    {activeJobId
                      ? "No images available in this job. Please upload some."
                      : "Create or select a job to start adding images."}
                  </div>
                ) : (
                  <div
                    ref={imageContainerRef}
                    className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-sm bg-muted"
                  >
                    <div
                      className="relative"
                      style={{
                        width: imageMeta.displayWidth || "auto",
                        height: imageMeta.displayHeight || "auto",
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                        transformOrigin: "top left",
                      }}
                    >
                      <div
                        className="relative"
                        style={{
                          width: imageMeta.displayWidth || "auto",
                          height: imageMeta.displayHeight || "auto",
                          transform: `scale(${zoom})`,
                          transformOrigin: "top left",
                        }}
                        onWheel={handleCanvasWheel}
                      >
                        <img
                          src={activeImage?.file_url}
                          alt={imageName}
                          className="block"
                          style={{
                            width: imageMeta.displayWidth || "auto",
                            height: imageMeta.displayHeight || "auto",
                          }}
                          onLoad={handleImageLoad}
                        />
                        <canvas
                          ref={canvasRef}
                          className="absolute left-0 top-0"
                          style={{ cursor: canvasCursor }}
                          width={imageMeta.displayWidth || 0}
                          height={imageMeta.displayHeight || 0}
                          onPointerDown={handleCanvasPointerDown}
                          onPointerMove={handleCanvasPointerMove}
                          onPointerUp={handleCanvasPointerUp}
                          onPointerLeave={handleCanvasPointerUp}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="flex h-full w-full max-w-sm min-h-0 flex-col border-l border-border bg-background">
            <AnnotationSidebar
              activeLabelId={activeLabelId}
              annotationCount={annotationCount}
              annotations={annotations}
              hiddenAnnotationIdSet={hiddenAnnotationIdSet}
              isLoadingAnnotations={isLoadingAnnotations}
              isLoadingProject={isLoadingProject}
              onAddLabel={openLabelDialog}
              onDeleteAnnotation={handleDeleteAnnotation}
              onLabelClick={handleSidebarLabelClick}
              onSelectAnnotation={handleSelectSidebarAnnotation}
              onToggleAnnotationVisibility={handleToggleAnnotationVisibility}
              projectLabels={projectLabels}
              selectedAnnotationId={selectedAnnotationId}
            />

            <div className="border-t border-border p-4">
              <Button
                type="button"
                className="w-full"
                onClick={handleMarkImageDone}
                disabled={!activeImage || isMarkingImageDone}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {isMarkingImageDone ? "Marking..." : "Mark done & next"}
              </Button>
            </div>

            <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add label</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="label-name">
                      Label name
                    </label>
                    <Input
                      id="label-name"
                      value={newLabelName}
                      onChange={(event) => setNewLabelName(event.target.value)}
                      placeholder="e.g. car"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="label-index">
                      Index
                    </label>
                    <Input
                      id="label-index"
                      type="number"
                      min="0"
                      value={newLabelIndex}
                      onChange={(event) => setNewLabelIndex(event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="label-color">
                      Color
                    </label>
                    <Input
                      id="label-color"
                      type="color"
                      value={newLabelColor}
                      onChange={(event) => setNewLabelColor(event.target.value)}
                      className="h-10 p-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsLabelDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveLabel} disabled={isSavingLabel}>
                    {isSavingLabel ? "Saving..." : "Save label"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configure auto-annotate</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="model-select">
                      Model
                    </label>
                    <NativeSelect
                    id="model-select"
                    className="w-full"
                    value={selectedModelId}
                    onChange={(event) => setSelectedModelId(event.target.value)}
                  >
                    <NativeSelectOption value="">Select a model</NativeSelectOption>
                    {models.map((model) => (
                      <NativeSelectOption key={model.id} value={String(model.id)}>
                        {model.name}
                      </NativeSelectOption>
                    ))}
                    </NativeSelect>
                  </div>
                  {!selectedModelId ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                      Select a model to load its classes, then map each model class to a project
                      class.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                        <span>Model classes</span>
                        <span>Project classes</span>
                      </div>
                      {(models.find((model) => String(model.id) === selectedModelId)?.classes ||
                        []
                      ).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                          This model has no classes.
                        </div>
                      ) : (project?.classes || []).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                          This project has no classes yet. Add labels first.
                        </div>
                      ) : (
                        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                          {(models.find(
                            (model) => String(model.id) === selectedModelId,
                          )?.classes || []).map((modelClass, index) => (
                            <div
                              key={`${selectedModelId}-class-${index}`}
                              className="grid grid-cols-[1.2fr_1fr] items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {modelClass || `Class ${index}`}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Index {index}
                                </p>
                              </div>
                              <NativeSelect
                                value={classMappings[index] || ""}
                                onChange={(event) =>
                                  setClassMappings((prev) => ({
                                    ...prev,
                                    [index]: event.target.value,
                                  }))
                                }
                              >
                                <NativeSelectOption value="">
                                  Ignore this class
                                </NativeSelectOption>
                                {(project?.classes || []).map((projectClass) => (
                                  <NativeSelectOption
                                    key={projectClass.id}
                                    value={String(projectClass.id)}
                                  >
                                    {projectClass.name} (#{projectClass.index})
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsMappingDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveAutoAnnotate} disabled={isSavingAutoAnnotate}>
                    {isSavingAutoAnnotate ? "Saving..." : "Save configuration"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={isShortcutLabelPickerOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsShortcutLabelPickerOpen(false);
                }
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Select label</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Hold C while your cursor is over the image, then choose the label
                    to draw with. Release C to close this picker.
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {projectLabels.map((label) => {
                      const labelColor = label.color || "#3b82f6";
                      const isActive = activeLabelId === label.id;
                      return (
                        <button
                          key={label.id}
                          type="button"
                          className={
                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition " +
                            (isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                          }
                          onClick={() => setActiveLabelId(label.id)}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-slate-300"
                              style={{ backgroundColor: labelColor }}
                            />
                            <span className="truncate font-medium">{label.name}</span>
                          </span>
                          <span
                            className={
                              "ml-3 shrink-0 font-mono text-xs " +
                              (isActive ? "text-slate-200" : "text-slate-400")
                            }
                          >
                            {labelColor}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {activeLabel ? (
                    <p className="text-xs text-slate-500">
                      Drawing with <span className="font-medium text-slate-700">{activeLabel.name}</span>.
                    </p>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isShortcutsDialogOpen} onOpenChange={setIsShortcutsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Keyboard shortcuts</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {keyboardShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <Badge variant="outline" className="font-mono">
                        {shortcut.key}
                      </Badge>
                      <p className="text-sm text-slate-600">{shortcut.description}</p>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsShortcutsDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog
              open={isDeleteLabelOpen}
              onOpenChange={(open) => {
                setIsDeleteLabelOpen(open);
                if (!open) {
                  setLabelToDelete(null);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete label?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deleting a label will delete all annotations associated with it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeleteLabel}>
                    Confirm delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
              open={isDeleteImageOpen}
              onOpenChange={(open) => {
                setIsDeleteImageOpen(open);
                if (!open) {
                  setImageToDelete(null);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete image?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deleting this image will remove all annotations linked to it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeleteImage}>
                    Confirm delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </aside>
        </div>
      </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
