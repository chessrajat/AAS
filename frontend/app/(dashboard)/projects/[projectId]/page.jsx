"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FolderKanban,
  Hand,
  Minus,
  Plus,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "../../../stores/authStore";
import { useApiStore } from "../../../stores/apiStore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProjectAnnotatePage() {
  const router = useRouter();
  const params = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    uploadProjectImages,
    fetchProjectImages,
    fetchProject,
    fetchAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    createProjectClass,
  } = useApiStore();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageContainerRef = useRef(null);
  const panStartRef = useRef(null);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [project, setProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [annotations, setAnnotations] = useState([]);
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
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [newLabelIndex, setNewLabelIndex] = useState("");
  const [imageMeta, setImageMeta] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
  });
  const minZoom = 0.5;
  const maxZoom = 2;
  const zoomStep = 0.05;
  const hasImages = images.length > 0;
  const activeImage = hasImages ? images[activeIndex] : null;
  const imageName = activeImage?.file?.split("/").pop() || "No image";
  const projectLabels = project?.classes ?? [];
  const hasLabels = projectLabels.length > 0;
  const annotationCount = annotations.length;

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    }
  }, [accessToken, router]);

  useEffect(() => {
    if (!accessToken || !params?.projectId) {
      return;
    }

    const loadImages = async () => {
      const result = await fetchProjectImages(params.projectId);
      if (result.ok) {
        setImages(result.data || []);
        setActiveIndex(0);
      }
    };
    loadImages();
  }, [accessToken, params?.projectId, fetchProjectImages]);

  useEffect(() => {
    setActiveLabelId(null);
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
      }
      setIsLoadingProject(false);
    };
    loadProject();

    return () => {
      isMounted = false;
    };
  }, [accessToken, params?.projectId, fetchProject, activeLabelId]);

  useEffect(() => {
    if (!activeImage?.id) {
      setAnnotations([]);
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
      setSelectedAnnotationId(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteAnnotation, selectedAnnotationId]);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

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

  const toDisplayBox = (annotation) => {
    const scale = getImageScale();
    return {
      x: Math.round(annotation.x_min * scale),
      y: Math.round(annotation.y_min * scale),
      w: Math.round((annotation.x_max - annotation.x_min) * scale),
      h: Math.round((annotation.y_max - annotation.y_min) * scale),
    };
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
      if (selected) {
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
  ]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsUploading(true);
    const result = await uploadProjectImages(params?.projectId, files);
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
    toast.success("Images uploaded", {
      description: `${files.length} image(s) added to the project.`,
    });
  };

  const handlePrevImage = () => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNextImage = () => {
    setActiveIndex((prev) => Math.min(prev + 1, images.length - 1));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(minZoom, Number((prev - zoomStep).toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(maxZoom, Number((prev + zoomStep).toFixed(2))));
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-16 flex-col items-center gap-3 border-r border-slate-200 bg-white py-4 md:flex">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-slate-100 transition hover:bg-slate-800"
        >
          <FolderKanban className="h-5 w-5" />
        </Link>
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-1 flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "draw" ? "secondary" : "ghost"}
                  className={
                    activeTool === "draw"
                      ? "bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : ""
                  }
                  onClick={() => setActiveTool("draw")}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Draw bounding box</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "select" ? "secondary" : "ghost"}
                  className={
                    activeTool === "select"
                      ? "bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : ""
                  }
                  onClick={() => setActiveTool("select")}
                >
                  <Crosshair className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Select or move box</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === "pan" ? "secondary" : "ghost"}
                  className={
                    activeTool === "pan"
                      ? "bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : ""
                  }
                  onClick={() => setActiveTool("pan")}
                >
                  <Hand className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Pan canvas</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <div className="flex flex-col items-center gap-2" />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
              Projects
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Annotation Workspace
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                Project #1
              </h1>
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
            <Button variant="outline" onClick={handleUploadClick} disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload images"}
            </Button>
            <Button variant="secondary">Auto annotate</Button>
            <Button>Save</Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col bg-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
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
                  {hasImages ? `Image ${activeIndex + 1}` : "No images"}
                </Badge>
                <span>{imageName}</span>
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
              <div className="relative flex h-full w-full max-w-4xl items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
                {!hasImages ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 text-center text-sm text-slate-500">
                    No images available in this project. Please upload some.
                  </div>
                ) : (
                  <div
                    ref={imageContainerRef}
                    className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-50"
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

          <aside className="w-full max-w-sm border-l border-slate-200 bg-white">
            <Tabs defaultValue="objects" className="h-full">
              <TabsList className="grid w-full grid-cols-2 rounded-none bg-slate-100">
                <TabsTrigger value="objects">Objects</TabsTrigger>
                <TabsTrigger value="labels">Labels</TabsTrigger>
              </TabsList>
              <TabsContent value="objects" className="h-full">
                <div className="flex h-full flex-col">
                  <div className="space-y-3 border-b border-slate-200 p-4">
                    <Input placeholder="Search frames or IDs" className="bg-white" />
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{annotationCount} active</Badge>
                      <Badge variant="outline">0 pending</Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                      {annotations.length === 0 ? (
                        <Card className="border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                          {isLoadingAnnotations
                            ? "Loading annotations..."
                            : "No annotations yet for this image."}
                        </Card>
                      ) : (
                        annotations.map((annotation) => {
                          const label = projectLabels.find(
                            (item) => item.id === annotation.project_class,
                          );
                          const width = annotation.x_max - annotation.x_min;
                          const height = annotation.y_max - annotation.y_min;
                          return (
                            <Card
                              key={annotation.id}
                              className={`border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm ${
                                selectedAnnotationId === annotation.id
                                  ? "ring-2 ring-slate-900 ring-offset-1"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedAnnotationId(annotation.id);
                                setActiveTool("select");
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  setSelectedAnnotationId(annotation.id);
                                  setActiveTool("select");
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span>Annotation #{annotation.id}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">
                                    {label?.name || "Unlabeled"}
                                  </Badge>
                                  {selectedAnnotationId === annotation.id ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        const result = await deleteAnnotation(annotation.id);
                                        if (!result.ok) {
                                          toast.error("Delete failed", {
                                            description:
                                              result.error || "Please try again.",
                                          });
                                          return;
                                        }
                                        setAnnotations((prev) =>
                                          prev.filter((item) => item.id !== annotation.id),
                                        );
                                        setSelectedAnnotationId(null);
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {width} × {height} • {label?.color || "#3b82f6"}
                              </p>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
              <TabsContent value="labels" className="h-full">
                <div className="flex h-full flex-col">
                  <div className="border-b border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Label set
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-slate-900">
                        Project classes
                      </h2>
                      <Button size="sm" variant="outline" onClick={openLabelDialog}>
                        Add label
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                      {!hasLabels ? (
                        <Card className="border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                          {isLoadingProject
                            ? "Loading labels..."
                            : "No labels defined for this project yet."}
                        </Card>
                      ) : (
                        projectLabels.map((label) => {
                          const labelColor = label.color || "#3b82f6";
                          return (
                            <Card
                              key={label.id}
                              className={`border-slate-200 bg-white p-3 text-sm ${
                                activeLabelId === label.id
                                  ? "ring-2 ring-slate-900 ring-offset-1"
                                  : ""
                              }`}
                              onClick={() => setActiveLabelId(label.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  setActiveLabelId(label.id);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: labelColor }}
                                  />
                                  <span className="font-medium text-slate-900">
                                    {label.name}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-400">
                                  Index {label.index}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                Tap to assign to selected box.
                              </p>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>

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
          </aside>
        </div>
      </div>
    </div>
  );
}
