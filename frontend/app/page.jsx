"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

const formatCount = (count, singular, plural = `${singular}s`) => {
  const value = Number(count) || 0;
  return `${value} ${value === 1 ? singular : plural}`;
};

const getUserInitials = (user) => {
  const name = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  const source = name || user?.username || "U";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export default function Home() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    createProject,
    deleteProject,
    updateProject,
    updateProjectUsers,
    fetchProjects,
    fetchProjectAssignableUsers,
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
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectUserIds, setEditProjectUserIds] = useState([]);
  const [assignableProjectUsers, setAssignableProjectUsers] = useState([]);
  const [isLoadingAssignableUsers, setIsLoadingAssignableUsers] = useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);

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

  const handleOpenEditProject = (project) => {
    setProjectToEdit(project);
    setEditProjectName(project.name || "");
    setEditProjectUserIds((project.members || []).map((member) => member.id));
    setAssignableProjectUsers(project.members || []);
    setIsLoadingAssignableUsers(true);
    fetchProjectAssignableUsers(project.id).then((result) => {
      if (result.ok) {
        setAssignableProjectUsers(result.data || []);
      } else {
        toast.error("Unable to load assignable users", {
          description: result.error || "Please try again.",
        });
      }
      setIsLoadingAssignableUsers(false);
    });
  };

  const handleToggleEditProjectUser = (userId, checked) => {
    setEditProjectUserIds((prev) => {
      if (checked) {
        return prev.includes(userId) ? prev : [...prev, userId];
      }
      return prev.filter((item) => item !== userId);
    });
  };

  const closeEditProjectDialog = () => {
    setProjectToEdit(null);
    setEditProjectName("");
    setEditProjectUserIds([]);
    setAssignableProjectUsers([]);
  };

  const handleConfirmEditProject = async (event) => {
    event.preventDefault();
    if (!projectToEdit) {
      return;
    }

    const nextName = editProjectName.trim();
    if (!nextName) {
      toast.error("Project name is required.");
      return;
    }

    const nextUserIds = editProjectUserIds;
    if (nextUserIds.length === 0) {
      toast.error("Assign at least one user to the project.");
      return;
    }

    setIsUpdatingProject(true);
    const result = await updateProject(projectToEdit.id, { name: nextName });
    if (!result.ok) {
      setIsUpdatingProject(false);
      toast.error("Project update failed", {
        description: result.error || "Please try again.",
      });
      return;
    }

    const currentUserIds = (projectToEdit.members || [])
      .map((member) => member.id)
      .sort((a, b) => a - b);
    const sortedNextUserIds = [...nextUserIds].sort((a, b) => a - b);
    const usersChanged =
      currentUserIds.length !== sortedNextUserIds.length ||
      currentUserIds.some((userId, index) => userId !== sortedNextUserIds[index]);

    if (usersChanged) {
      const usersResult = await updateProjectUsers(projectToEdit.id, sortedNextUserIds);
      if (!usersResult.ok) {
        setIsUpdatingProject(false);
        toast.error("Project users update failed", {
          description: usersResult.error || "Please try again.",
        });
        return;
      }
      useApiStore.setState((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectToEdit.id
            ? { ...project, ...result.data, members: usersResult.data || [] }
            : project,
        ),
      }));
    }

    setIsUpdatingProject(false);
    toast.success("Project updated", {
      description: nextName,
    });
    closeEditProjectDialog();
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
        <header className="aas-header">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <p className="aas-kicker">
                Dashboard
              </p>
              <h1 className="aas-page-title">Projects</h1>
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
              <Button variant="default" className="cursor-pointer">New Project</Button>
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
        <div className="aas-content">
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {projects.map((project) => {
                const projectImage = project.first_job_image_url;
                const jobCount = project.job_count ?? project.jobs?.length ?? 0;
                const classCount = project.classes?.length || 0;
                const members = project.members || [];
                const visibleMembers = members.slice(0, 3);
                const remainingMembers = Math.max(members.length - visibleMembers.length, 0);

                return (
                  <div key={project.id} className="relative">
                    <Link href={`/projects/${project.id}/jobs`} className="block">
                      <Card className="overflow-hidden border-border bg-card p-0 transition hover:border-foreground">
                        <div className="aspect-[16/9] border-b border-border bg-muted">
                          {projectImage ? (
                            <div
                              aria-hidden="true"
                              className="h-full w-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${projectImage}")` }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-secondary text-xs font-medium uppercase text-muted-foreground">
                              [ no image ]
                            </div>
                          )}
                        </div>
                        <div className="space-y-4 p-4">
                          <div className="pr-9">
                            <h2 className="min-h-12 text-lg font-bold leading-tight text-slate-900">
                              {project.name}
                            </h2>
                            <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                              {project.description || "No description"}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 border-y border-border py-3 text-xs text-muted-foreground">
                            <span>{formatCount(jobCount, "job")}</span>
                            <span>{formatCount(classCount, "class", "classes")}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-2">
                              {visibleMembers.map((member) => (
                                <span
                                  key={member.id}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-card bg-muted text-[10px] font-medium text-foreground"
                                  title={member.username}
                                >
                                  {getUserInitials(member)}
                                </span>
                              ))}
                              {remainingMembers > 0 ? (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-card bg-primary text-[10px] font-medium text-primary-foreground">
                                  +{remainingMembers}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground">open</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                    <div className="absolute right-3 top-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 bg-card/90 text-slate-500 hover:text-slate-900"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenEditProject(project);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit project
                          </DropdownMenuItem>
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
                );
              })}
            </div>
          )}
        </div>
        <Dialog
          open={Boolean(projectToEdit)}
          onOpenChange={(open) => {
            if (!open && !isUpdatingProject) {
              closeEditProjectDialog();
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleConfirmEditProject}>
              <div className="space-y-2">
                <Label htmlFor="edit-project-name">Project name</Label>
                <Input
                  id="edit-project-name"
                  value={editProjectName}
                  onChange={(event) => setEditProjectName(event.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
              </div>
              <div className="space-y-3">
                <Label>Assigned users</Label>
                <div className="max-h-64 overflow-y-auto border border-border">
                  {isLoadingAssignableUsers ? (
                    <p className="p-3 text-sm text-muted-foreground">Loading users...</p>
                  ) : assignableProjectUsers.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No users available.</p>
                  ) : (
                    assignableProjectUsers.map((user) => {
                      const isChecked = editProjectUserIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-3 border-b border-border p-3 last:border-b-0"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              handleToggleEditProjectUser(user.id, Boolean(checked))
                            }
                          />
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-medium text-foreground">
                            {getUserInitials(user)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {user.username}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {user.email || user.role || "user"}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUpdatingProject}
                  onClick={closeEditProjectDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingProject}>
                  {isUpdatingProject ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
