"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Pencil, Play, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function ProjectJobsPage() {
  const params = useParams();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    createProjectJob,
    deleteJob,
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
  }, [accessToken, projectId, fetchProject, fetchProjectJobs]);

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

  if (!accessToken) {
    return null;
  }

  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <header className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
              Projects
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Jobs
              </p>
              <h1 className="text-xl font-semibold text-slate-900">
                {project?.name || `Project #${projectId}`}
              </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6 bg-slate-50 px-6 py-6">
          <Card className="border-slate-200 bg-white p-4">
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

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[1fr_1fr_110px_170px] bg-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
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
                  className="grid grid-cols-[1fr_1fr_110px_170px] items-center border-t border-slate-200 px-4 py-3 text-sm"
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
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit job"
                      onClick={() => handleOpenEditJob(job)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete job"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setJobToDelete(job)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
