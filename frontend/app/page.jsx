"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "./stores/authStore";
import { useApiStore } from "./stores/apiStore";
import { toast } from "sonner";
import HomeSidebar from "./components/HomeSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function Home() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    createProject,
    deleteProject,
    fetchProjects,
    isCreatingProject,
    isLoadingProjects,
    projects,
  } = useApiStore();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectClasses, setProjectClasses] = useState([
    { name: "", index: 0, color: "#3b82f6" },
  ]);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const resetProjectForm = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectClasses([{ name: "", index: 0, color: "#3b82f6" }]);
  };

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    fetchProjects(accessToken);
  }, [accessToken, fetchProjects]);

  const randomColor = () => {
    const channel = () => Math.floor(80 + Math.random() * 160);
    const toHex = (value) => value.toString(16).padStart(2, "0");
    return `#${toHex(channel())}${toHex(channel())}${toHex(channel())}`;
  };

  const handleAddClass = () => {
    setProjectClasses((prev) => [
      ...prev,
      { name: "", index: prev.length, color: randomColor() },
    ]);
  };

  const handleRemoveClass = (indexToRemove) => {
    setProjectClasses((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleClassChange = (index, field, value) => {
    setProjectClasses((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: projectName.trim(),
      description: projectDescription.trim(),
      classes: projectClasses
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          index: Number(item.index),
          color: item.color,
        })),
    };

    const result = await createProject(payload, accessToken);
    if (!result.ok) {
      toast.error("Project creation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }

    toast.success("Project created", {
      description: payload.name || "New project added.",
    });
    setIsProjectModalOpen(false);
    resetProjectForm();
  };

  const handleOpenDeleteProject = (project) => {
    setProjectToDelete(project);
    setIsDeleteProjectOpen(true);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) {
      return;
    }
    const result = await deleteProject(projectToDelete.id);
    if (!result.ok) {
      toast.error("Delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Project deleted", {
      description: projectToDelete.name || "Project removed.",
    });
    setIsDeleteProjectOpen(false);
    setProjectToDelete(null);
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
                Dashboard
              </p>
              <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
            </div>
          </div>
          <Dialog
            open={isProjectModalOpen}
            onOpenChange={(open) => {
              setIsProjectModalOpen(open);
              if (!open) {
                resetProjectForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="default">New Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
              </DialogHeader>
              <form className="space-y-6" onSubmit={handleProjectSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project name</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project One"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Input
                    id="project-description"
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                    placeholder="Short description"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Classes</Label>
                    <Button type="button" variant="outline" onClick={handleAddClass}>
                      <Plus />
                      Add class
                    </Button>
                  </div>
                  <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                    {projectClasses.map((projectClass, index) => (
                      <div
                        key={`class-${index}`}
                        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3"
                      >
                        <div className="min-w-[140px] flex-1 space-y-2">
                          <Label htmlFor={`class-name-${index}`}>Class name</Label>
                          <Input
                            id={`class-name-${index}`}
                            value={projectClass.name}
                            onChange={(event) =>
                              handleClassChange(index, "name", event.target.value)
                            }
                            placeholder="person"
                          />
                        </div>
                        <div className="w-[120px] space-y-2">
                          <Label htmlFor={`class-index-${index}`}>Index</Label>
                          <Input
                            id={`class-index-${index}`}
                            type="number"
                            value={projectClass.index}
                            onChange={(event) =>
                              handleClassChange(
                                index,
                                "index",
                                Number(event.target.value),
                              )
                            }
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <Label htmlFor={`class-color-${index}`}>Color</Label>
                          <input
                            id={`class-color-${index}`}
                            type="color"
                            value={projectClass.color}
                            onChange={(event) =>
                              handleClassChange(index, "color", event.target.value)
                            }
                            className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-slate-500 hover:text-slate-900"
                          onClick={() => handleRemoveClass(index)}
                          disabled={projectClasses.length === 1}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsProjectModalOpen(false);
                      resetProjectForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreatingProject}>
                    {isCreatingProject ? "Creating..." : "Create project"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </header>
        <div className="flex-1 space-y-6 bg-slate-50 px-6 py-6">
          {isLoadingProjects ? (
            <Card className="border-dashed border-slate-200/70 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">Loading projects...</p>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="border-dashed border-slate-200/70 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">
                No projects available yet. Create one to get started.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="relative">
                  <Link href={`/projects/${project.id}`} className="block">
                    <Card className="border-slate-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                      <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {project.name}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {project.description || "No description"}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {project.classes?.length || 0} classes
                        </p>
                      </div>
                    </Card>
                  </Link>
                  <div className="absolute right-3 top-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenDeleteProject(project);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <AlertDialog
          open={isDeleteProjectOpen}
          onOpenChange={(open) => {
            setIsDeleteProjectOpen(open);
            if (!open) {
              setProjectToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogDescription>
                Deleting a project will remove its images, labels, and annotations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteProject}>
                Confirm delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
