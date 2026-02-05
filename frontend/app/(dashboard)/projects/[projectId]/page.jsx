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
  ZoomIn,
  ZoomOut,
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

export default function ProjectAnnotatePage() {
  const router = useRouter();
  const params = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { uploadProjectImages, fetchProjectImages } = useApiStore();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const minZoom = 0.5;
  const maxZoom = 2;
  const zoomStep = 0.05;

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

  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);

  if (!accessToken) {
    return null;
  }

  const hasImages = images.length > 0;
  const activeImage = hasImages ? images[activeIndex] : null;
  const imageName = activeImage?.file?.split("/").pop() || "No image";

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

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-16 flex-col items-center gap-3 border-r border-slate-200 bg-white py-4 md:flex">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-slate-100 transition hover:bg-slate-800"
        >
          <FolderKanban className="h-5 w-5" />
        </Link>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Button size="icon" variant="secondary">
            <Square className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost">
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost">
            <Hand className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button size="icon" variant="ghost">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost">
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
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
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
                    <img
                      src={activeImage?.file_url}
                      alt={imageName}
                      className="max-h-full max-w-full object-contain transition-transform duration-200"
                      style={{ transform: `scale(${zoom})` }}
                    />
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
                      <Badge variant="secondary">3 active</Badge>
                      <Badge variant="outline">2 pending</Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                      {["Vehicle 1", "Vehicle 2", "Pedestrian 1"].map((item) => (
                        <Card
                          key={item}
                          className="border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span>{item}</span>
                            <Badge variant="secondary">car</Badge>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            432 × 220 • #FF4D7A
                          </p>
                        </Card>
                      ))}
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
                    <h2 className="text-base font-semibold text-slate-900">
                      Project classes
                    </h2>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 p-4">
                      {[
                        { name: "car", color: "bg-rose-400/20 text-rose-300" },
                        { name: "person", color: "bg-emerald-400/20 text-emerald-300" },
                        { name: "truck", color: "bg-sky-400/20 text-sky-300" },
                      ].map((label) => (
                        <Card
                          key={label.name}
                          className={`border-slate-200 p-3 text-sm ${label.color}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{label.name}</span>
                            <span className="text-xs">Index 0</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Tap to assign to selected box.
                          </p>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </div>
    </div>
  );
}
