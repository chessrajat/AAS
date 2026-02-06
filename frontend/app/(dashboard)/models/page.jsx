"use client";

import { useEffect, useState } from "react";
import { Cpu, Plus } from "lucide-react";
import { toast } from "sonner";

import HomeSidebar from "../../components/HomeSidebar";
import { useAuthStore } from "../../stores/authStore";
import { useApiStore } from "../../stores/apiStore";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ModelsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    models,
    isLoadingModels,
    isCreatingModel,
    fetchModels,
    createModel,
  } = useApiStore();
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [modelFile, setModelFile] = useState(null);

  const resetModelForm = () => {
    setModelName("");
    setModelDescription("");
    setModelFile(null);
  };

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    fetchModels(accessToken);
  }, [accessToken, fetchModels]);

  const handleModelSubmit = async (event) => {
    event.preventDefault();
    if (!modelName.trim()) {
      toast.error("Model name is required.");
      return;
    }
    if (!modelFile) {
      toast.error("Model file is required.");
      return;
    }

    const payload = {
      name: modelName.trim(),
      description: modelDescription.trim(),
      file: modelFile,
    };

    const result = await createModel(payload, accessToken);
    if (!result.ok) {
      toast.error("Model upload failed", {
        description: result.error || "Please try again.",
      });
      return;
    }

    toast.success("Model uploaded", {
      description: payload.name,
    });
    setIsModelModalOpen(false);
    resetModelForm();
  };

  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <header className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Workspace
              </p>
              <h1 className="text-xl font-semibold text-slate-900">Models</h1>
            </div>
          </div>
          <Dialog
            open={isModelModalOpen}
            onOpenChange={(open) => {
              setIsModelModalOpen(open);
              if (!open) {
                resetModelForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus />
                Add model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Add model</DialogTitle>
              </DialogHeader>
              <form className="space-y-6" onSubmit={handleModelSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="model-name">Model name</Label>
                  <Input
                    id="model-name"
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder="YOLOv8n"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-description">Description</Label>
                  <Input
                    id="model-description"
                    value={modelDescription}
                    onChange={(event) => setModelDescription(event.target.value)}
                    placeholder="Short description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-file">Model file</Label>
                  <Input
                    id="model-file"
                    type="file"
                    onChange={(event) => setModelFile(event.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-slate-500">
                    Classes are detected automatically from the uploaded model.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModelModalOpen(false);
                      resetModelForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreatingModel}>
                    {isCreatingModel ? "Uploading..." : "Upload model"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </header>
        <div className="flex-1 space-y-6 bg-slate-50 px-6 py-6">
          {isLoadingModels ? (
            <Card className="border-dashed border-slate-200/70 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">Loading models...</p>
            </Card>
          ) : models.length === 0 ? (
            <Card className="border-dashed border-slate-200/70 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">
                No models yet. Upload your first model to get started.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {models.map((model) => (
                <Card
                  key={model.id}
                  className="border-slate-200/70 bg-white p-5 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                      <Cpu className="size-4 text-slate-500" />
                      {model.model_type?.toUpperCase() || "MODEL"}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {model.name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {model.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                      <span>{model.classes?.length || 0} classes</span>
                      <span>{model.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
