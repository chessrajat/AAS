"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Download, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import HomeSidebar from "../../../../components/HomeSidebar";
import { useAuthStore } from "../../../../stores/authStore";
import { useApiStore } from "../../../../stores/apiStore";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function ProjectJobsPage() {
  const params = useParams();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    createProjectJob,
    createJobExport,
    deleteJob,
    fetchJobExport,
    fetchProject,
    fetchProjectJobs,
    updateJob,
  } = useApiStore();
  const projectId = params?.projectId;
  const [project, setProject] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobDescription, setNewJobDescription] = useState("");
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [editJobName, setEditJobName] = useState("");
  const [editJobDescription, setEditJobDescription] = useState("");
  const [jobToDelete, setJobToDelete] = useState(null);
  const [exportingJobId, setExportingJobId] = useState(null);
  const [exportProgressByJobId, setExportProgressByJobId] = useState({});

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    }
  }, [accessToken, router]);

  useEffect(() => {
    if (!accessToken || !projectId) {
      return;
    }
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      const [projectResult, jobsResult] = await Promise.all([
        fetchProject(projectId),
        fetchProjectJobs(projectId),
      ]);
      if (!isMounted) {
        return;
      }
      if (projectResult.ok) {
        setProject(projectResult.data);
      } else {
        toast.error("Project unavailable", {
          description: projectResult.error || "You do not have access to this project.",
        });
        router.replace("/");
        return;
      }
      if (jobsResult.ok) {
        setJobs(jobsResult.data || []);
      } else {
        toast.error("Unable to load jobs", {
          description: jobsResult.error || "Please try again.",
        });
      }
      setIsLoading(false);
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [accessToken, projectId, fetchProject, fetchProjectJobs, router]);

  const handleCreateJob = async (event) => {
    event.preventDefault();
    const name = newJobName.trim();
    if (!name) {
      toast.error("Job name is required.");
      return;
    }

    setIsSavingJob(true);
    const result = await createProjectJob(projectId, {
      name,
      description: newJobDescription.trim(),
    });
    setIsSavingJob(false);
    if (!result.ok) {
      toast.error("Job creation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setJobs((prev) => [...prev, result.data]);
    setNewJobName("");
    setNewJobDescription("");
  };

  const handleOpenEditJob = (job) => {
    setJobToEdit(job);
    setEditJobName(job.name || "");
    setEditJobDescription(job.description || "");
  };

  const handleUpdateJob = async (event) => {
    event.preventDefault();
    if (!jobToEdit) {
      return;
    }
    const name = editJobName.trim();
    if (!name) {
      toast.error("Job name is required.");
      return;
    }

    setIsSavingJob(true);
    const result = await updateJob(jobToEdit.id, {
      name,
      description: editJobDescription.trim(),
    });
    setIsSavingJob(false);
    if (!result.ok) {
      toast.error("Job update failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setJobs((prev) => prev.map((job) => (job.id === result.data.id ? result.data : job)));
    setJobToEdit(null);
    setEditJobName("");
    setEditJobDescription("");
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) {
      return;
    }
    const result = await deleteJob(jobToDelete.id);
    if (!result.ok) {
      toast.error("Job delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
    setJobToDelete(null);
  };

  const handleExportJob = async (job) => {
    if (!job?.id) {
      return;
    }
    setExportingJobId(job.id);
    setExportProgressByJobId((prev) => ({ ...prev, [job.id]: 0 }));
    const result = await createJobExport(job.id);
    if (!result.ok) {
      toast.error("Job export failed", {
        description: result.error || "Please try again.",
      });
      setExportingJobId(null);
      setExportProgressByJobId((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      return;
    }

    toast.success("Export queued", {
      description: "The worker will prepare the ZIP shortly.",
    });

    let statusData = result.data;
    while (statusData?.status === "pending" || statusData?.status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResult = await fetchJobExport(job.id, statusData.id);
      if (!statusResult.ok) {
        toast.error("Job export failed", {
          description: statusResult.error || "Unable to load export status.",
        });
        setExportingJobId(null);
        setExportProgressByJobId((prev) => {
          const next = { ...prev };
          delete next[job.id];
          return next;
        });
        return;
      }
      statusData = statusResult.data;
      setExportProgressByJobId((prev) => ({
        ...prev,
        [job.id]: Math.round(statusData?.progress_percent || 0),
      }));
    }

    if (statusData?.status !== "completed" || !statusData?.file_url) {
      toast.error("Job export failed", {
        description: statusData?.error_message || "The export did not complete.",
      });
      setExportingJobId(null);
      setExportProgressByJobId((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      return;
    }

    const link = document.createElement("a");
    link.href = statusData.file_url;
    link.download = `job-${job.id}-yolov8.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setExportingJobId(null);
    setExportProgressByJobId((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });
  };

  if (!accessToken) {
    return null;
  }

  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <header className="aas-header">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
              Projects
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <div>
              <p className="aas-kicker">
                Jobs
              </p>
              <h1 className="aas-page-title">
                {project?.name || `Project #${projectId}`}
              </h1>
            </div>
          </div>
        </header>

        <main className="aas-content">
          <Card className="border-border bg-card p-4">
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              onSubmit={handleCreateJob}
            >
              <div className="space-y-2">
                <Label htmlFor="new-job-name">Job name</Label>
                <Input
                  id="new-job-name"
                  value={newJobName}
                  onChange={(event) => setNewJobName(event.target.value)}
                  placeholder="Batch 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-job-description">Description</Label>
                <Input
                  id="new-job-description"
                  value={newJobDescription}
                  onChange={(event) => setNewJobDescription(event.target.value)}
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isSavingJob}>
                  <Plus />
                  {isSavingJob ? "Saving..." : "Add job"}
                </Button>
              </div>
            </form>
          </Card>

          <div className="overflow-hidden rounded-sm border border-border bg-card">
            <div className="grid grid-cols-[1fr_1fr_110px_150px] bg-muted px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <span>Name</span>
              <span>Description</span>
              <span>Images</span>
              <span className="text-right">Actions</span>
            </div>
            {isLoading ? (
              <div className="px-4 py-6 text-sm text-slate-500">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                No jobs yet. Add a job to start uploading images.
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="grid grid-cols-[1fr_1fr_110px_150px] items-center border-t border-border px-4 py-3 text-sm"
                >
                  <span className="font-medium text-slate-900">{job.name}</span>
                  <span className="truncate text-slate-500">
                    {job.description || "No description"}
                  </span>
                  <span className="text-slate-500">{job.image_count || 0}</span>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/projects/${projectId}?jobId=${job.id}`)}
                    >
                      <Play className="h-4 w-4" />
                      Open
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Job actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          disabled={exportingJobId === job.id}
                          onClick={() => handleExportJob(job)}
                        >
                          <Download className="h-4 w-4" />
                          {exportingJobId === job.id
                            ? `Exporting ${exportProgressByJobId[job.id] || 0}%`
                            : "Export job"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEditJob(job)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-600"
                          onClick={() => setJobToDelete(job)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        <Dialog
          open={Boolean(jobToEdit)}
          onOpenChange={(open) => {
            if (!open) {
              setJobToEdit(null);
              setEditJobName("");
              setEditJobDescription("");
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit job</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleUpdateJob}>
              <div className="space-y-2">
                <Label htmlFor="edit-job-name">Job name</Label>
                <Input
                  id="edit-job-name"
                  value={editJobName}
                  onChange={(event) => setEditJobName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-job-description">Description</Label>
                <Input
                  id="edit-job-description"
                  value={editJobDescription}
                  onChange={(event) => setEditJobDescription(event.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setJobToEdit(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingJob}>
                  {isSavingJob ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(jobToDelete)}
          onOpenChange={(open) => {
            if (!open) {
              setJobToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete job?</AlertDialogTitle>
              <AlertDialogDescription>
                Deleting a job will remove its images and annotations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteJob}>
                Confirm delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
