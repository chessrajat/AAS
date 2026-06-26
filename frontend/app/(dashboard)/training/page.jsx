"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Download, ListChecks, Play, Plus, RefreshCw, RotateCcw, Save, Settings2, Tags, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import HomeSidebar from "../../components/HomeSidebar";
import { useAuthStore } from "../../stores/authStore";
import { useApiStore } from "../../stores/apiStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const TASK_OPTIONS = ["detect", "segment", "classify", "pose", "obb"];
const DEFAULT_CLASSES = [{ name: "", index: 0 }];

const DEFAULT_TRAINING_ARGS = {
  epochs: 100,
  imgsz: 640,
  batch: 16,
  patience: 50,
  workers: 8,
  seed: 0,
  optimizer: "auto",
  lr0: 0.01,
  lrf: 0.01,
  momentum: 0.937,
  weight_decay: 0.0005,
  warmup_epochs: 3,
  cos_lr: false,
  cache: false,
  pretrained: true,
  amp: true,
};

const CANCELLABLE_TRAINING_STATUSES = new Set(["pending", "running"]);
const RESTARTABLE_TRAINING_STATUSES = new Set(["completed", "failed", "cancelled"]);

const boolToText = (value) => (value ? "true" : "false");

export default function TrainingPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    applyTrainingSplit,
    cancelTrainingJob,
    createTrainingConfig,
    createTrainingClass,
    createTrainingJob,
    createTrainingPipeline,
    deleteTrainingJob,
    deleteTrainingClass,
    fetchModels,
    fetchTrainingDatasets,
    fetchTrainingConfigs,
    fetchTrainingJobs,
    fetchTrainingPipeline,
    fetchTrainingPipelines,
    downloadTrainingArtifact,
    downloadTrainingJobArtifactsZip,
    isCreatingTrainingPipeline,
    isLoadingTrainingPipelines,
    models,
    trainingDatasets,
    trainingPipelines,
    restartTrainingJob,
    updateTrainingClass,
    updateTrainingConfig,
  } = useApiStore();

  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [isClassesDialogOpen, setIsClassesDialogOpen] = useState(false);
  const [isDatasetDialogOpen, setIsDatasetDialogOpen] = useState(false);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [pipelineTask, setPipelineTask] = useState("detect");
  const [pipelineClasses, setPipelineClasses] = useState(DEFAULT_CLASSES);
  const [activePipelineId, setActivePipelineId] = useState("");
  const [activePipeline, setActivePipeline] = useState(null);
  const [classRows, setClassRows] = useState([]);
  const [newClassName, setNewClassName] = useState("");
  const [newClassIndex, setNewClassIndex] = useState(0);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [trainPercent, setTrainPercent] = useState(80);
  const [valPercent, setValPercent] = useState(10);
  const [testPercent, setTestPercent] = useState(10);
  const [splitSeed, setSplitSeed] = useState(42);
  const [isApplyingSplit, setIsApplyingSplit] = useState(false);
  const [configName, setConfigName] = useState("Default training");
  const [baseModel, setBaseModel] = useState("");
  const [trainingArgs, setTrainingArgs] = useState(DEFAULT_TRAINING_ARGS);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isQueueingJob, setIsQueueingJob] = useState(false);
  const [selectedArtifactByJob, setSelectedArtifactByJob] = useState({});
  const [downloadingArtifactKey, setDownloadingArtifactKey] = useState("");
  const [trainingJobActionKey, setTrainingJobActionKey] = useState("");

  const splitTotal = Number(trainPercent) + Number(valPercent) + Number(testPercent);
  const latestJob = jobs[0];
  const selectedDataset = useMemo(
    () => trainingDatasets.find((dataset) => String(dataset.id) === String(selectedDatasetId)),
    [selectedDatasetId, trainingDatasets],
  );
  const selectedConfig = useMemo(
    () => configs.find((config) => String(config.id) === String(selectedConfigId)),
    [configs, selectedConfigId],
  );
  const selectedModel = useMemo(
    () => models.find((model) => `ai_model:${model.id}` === baseModel),
    [baseModel, models],
  );
  const availableBaseModels = useMemo(
    () => models.filter((model) => model.file_url || model.file),
    [models],
  );
  const artifactTypeLabels = {
    best_model: "Best model",
    last_model: "Last model",
    results: "Results",
    confusion_matrix: "Confusion matrix",
    log: "Log",
    dataset_zip: "Dataset ZIP",
  };
  const selectedDatasetAssetCount = selectedDataset?.asset_count || 0;

  const resetPipelineForm = () => {
    setPipelineName("");
    setPipelineDescription("");
    setPipelineTask("detect");
    setPipelineClasses(DEFAULT_CLASSES);
  };

  const refreshActivePipeline = useCallback(
    async (pipelineId = activePipelineId) => {
      if (!pipelineId) {
        return;
      }
      const [pipelineResult, configsResult, jobsResult] = await Promise.all([
        fetchTrainingPipeline(pipelineId),
        fetchTrainingConfigs(pipelineId),
        fetchTrainingJobs(pipelineId),
      ]);
      if (pipelineResult.ok) {
        setActivePipeline(pipelineResult.data);
        const nextClasses = pipelineResult.data?.classes || [];
        setClassRows(nextClasses.map((item) => ({ ...item })));
        setNewClassIndex(nextClasses.length ? Math.max(...nextClasses.map((item) => item.index)) + 1 : 0);
        const splitConfig = pipelineResult.data?.split_config;
        if (splitConfig) {
          setTrainPercent(splitConfig.train_percent);
          setValPercent(splitConfig.val_percent);
          setTestPercent(splitConfig.test_percent);
          setSplitSeed(splitConfig.seed);
        }
      }
      if (configsResult.ok) {
        const nextConfigs = configsResult.data || [];
        setConfigs(nextConfigs);
        const nextConfig =
          nextConfigs.find((config) => String(config.id) === String(selectedConfigId)) ||
          nextConfigs[0];
        if (nextConfig) {
          setSelectedConfigId(String(nextConfig.id));
          setConfigName(nextConfig.name);
          setBaseModel(nextConfig.base_model || "");
          setTrainingArgs({ ...DEFAULT_TRAINING_ARGS, ...(nextConfig.args || {}) });
        } else {
          setSelectedConfigId("");
          setConfigName("Default training");
          setBaseModel("");
          setTrainingArgs(DEFAULT_TRAINING_ARGS);
        }
      }
      if (jobsResult.ok) {
        setJobs(jobsResult.data || []);
      }
    },
    [
      activePipelineId,
      fetchTrainingConfigs,
      fetchTrainingJobs,
      fetchTrainingPipeline,
      selectedConfigId,
    ],
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    fetchTrainingPipelines();
    fetchTrainingDatasets().then((result) => {
      const firstDatasetId = result.data?.[0]?.id;
      if (result.ok && firstDatasetId) {
        setSelectedDatasetId((current) => current || String(firstDatasetId));
      }
    });
    fetchModels(accessToken);
  }, [accessToken, fetchModels, fetchTrainingDatasets, fetchTrainingPipelines]);

  const handleClassChange = (index, field, value) => {
    setPipelineClasses((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleClassRowChange = (classId, field, value) => {
    setClassRows((prev) =>
      prev.map((item) =>
        item.id === classId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleAddTrainingClass = async () => {
    if (!activePipelineId) {
      return;
    }
    const name = newClassName.trim();
    if (!name) {
      toast.error("Class name is required.");
      return;
    }
    setIsSavingClass(true);
    const result = await createTrainingClass(activePipelineId, {
      name,
      index: Number(newClassIndex),
    });
    setIsSavingClass(false);
    if (!result.ok) {
      toast.error("Class creation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Class added", {
      description: name,
    });
    setNewClassName("");
    await refreshActivePipeline();
  };

  const handleSaveTrainingClass = async (trainingClass) => {
    const name = trainingClass.name.trim();
    if (!name) {
      toast.error("Class name is required.");
      return;
    }
    setIsSavingClass(true);
    const result = await updateTrainingClass(trainingClass.id, {
      name,
      index: Number(trainingClass.index),
    });
    setIsSavingClass(false);
    if (!result.ok) {
      toast.error("Class update failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Class updated", {
      description: name,
    });
    await refreshActivePipeline();
  };

  const handleDeleteTrainingClass = async (trainingClass) => {
    setIsSavingClass(true);
    const result = await deleteTrainingClass(trainingClass.id);
    setIsSavingClass(false);
    if (!result.ok) {
      toast.error("Class delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Class deleted", {
      description: trainingClass.name,
    });
    await refreshActivePipeline();
  };

  const handleCreatePipeline = async (event) => {
    event.preventDefault();
    const classes = pipelineClasses
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), index: Number(item.index) }));
    if (!pipelineName.trim()) {
      toast.error("Pipeline name is required.");
      return;
    }
    if (classes.length === 0) {
      toast.error("Add at least one class.");
      return;
    }
    const result = await createTrainingPipeline({
      name: pipelineName.trim(),
      description: pipelineDescription.trim(),
      task: pipelineTask,
      classes,
    });
    if (!result.ok) {
      toast.error("Pipeline creation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Training pipeline created", {
      description: result.data.name,
    });
    setActivePipelineId(String(result.data.id));
    await refreshActivePipeline(String(result.data.id));
    setIsPipelineDialogOpen(false);
    resetPipelineForm();
  };

  const handleApplySplit = async () => {
    if (!activePipelineId) {
      toast.error("Select a training pipeline first.");
      return;
    }
    if (splitTotal !== 100) {
      toast.error("Split must total 100%.");
      return;
    }
    setIsApplyingSplit(true);
    const result = await applyTrainingSplit(activePipelineId, {
      train_percent: Number(trainPercent),
      val_percent: Number(valPercent),
      test_percent: Number(testPercent),
      seed: Number(splitSeed),
    });
    setIsApplyingSplit(false);
    if (!result.ok) {
      toast.error("Split failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Split applied", {
      description: `${result.data.train_count} train, ${result.data.val_count} val, ${result.data.test_count} test.`,
    });
    setIsSplitDialogOpen(false);
    await refreshActivePipeline();
  };

  const setTrainingArg = (key, value) => {
    setTrainingArgs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectConfig = (value) => {
    setSelectedConfigId(value);
    const config = configs.find((item) => String(item.id) === String(value));
    if (!config) {
      return;
    }
    setConfigName(config.name);
    setBaseModel(config.base_model || "");
    setTrainingArgs({ ...DEFAULT_TRAINING_ARGS, ...(config.args || {}) });
  };

  const getDownloadFilename = (headers, fallback) => {
    const disposition = headers?.["content-disposition"];
    const match = disposition?.match(/filename="?([^";]+)"?/i);
    return match?.[1] || fallback;
  };

  const downloadBlob = (blob, filename) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleDownloadSelectedArtifact = async (job) => {
    const artifacts = job.artifacts || [];
    const artifactId = selectedArtifactByJob[job.id] || artifacts[0]?.id;
    const artifact = artifacts.find((item) => String(item.id) === String(artifactId));
    if (!artifact) {
      toast.error("No artifact selected.");
      return;
    }
    setDownloadingArtifactKey(`artifact-${artifact.id}`);
    const result = await downloadTrainingArtifact(artifact.id);
    setDownloadingArtifactKey("");
    if (!result.ok) {
      toast.error("Artifact download failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    downloadBlob(
      result.data,
      getDownloadFilename(result.headers, `training-artifact-${artifact.id}`),
    );
  };

  const handleDownloadJobArtifactsZip = async (job) => {
    setDownloadingArtifactKey(`job-${job.id}`);
    const result = await downloadTrainingJobArtifactsZip(job.id);
    setDownloadingArtifactKey("");
    if (!result.ok) {
      toast.error("Artifacts ZIP download failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    downloadBlob(
      result.data,
      getDownloadFilename(result.headers, `training-job-${job.id}-artifacts.zip`),
    );
  };

  const replaceTrainingJob = (updatedJob) => {
    setJobs((prev) => prev.map((job) => (job.id === updatedJob.id ? updatedJob : job)));
  };

  const handleCancelTrainingJob = async (job) => {
    setTrainingJobActionKey(`cancel-${job.id}`);
    const result = await cancelTrainingJob(job.id);
    setTrainingJobActionKey("");
    if (!result.ok) {
      toast.error("Cancel failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    replaceTrainingJob(result.data);
    toast.success(`Training job #${job.id} cancelled.`);
  };

  const handleRestartTrainingJob = async (job) => {
    setTrainingJobActionKey(`restart-${job.id}`);
    const result = await restartTrainingJob(job.id);
    setTrainingJobActionKey("");
    if (!result.ok) {
      toast.error("Restart failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setJobs((prev) => [result.data, ...prev]);
    toast.success(`Training job #${result.data.id} queued.`);
  };

  const handleDeleteTrainingJob = async (job) => {
    setTrainingJobActionKey(`delete-${job.id}`);
    const result = await deleteTrainingJob(job.id);
    setTrainingJobActionKey("");
    if (!result.ok) {
      toast.error("Delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setJobs((prev) => prev.filter((item) => item.id !== job.id));
    toast.success(`Training job #${job.id} deleted.`);
  };

  const handleSaveConfig = async () => {
    if (!activePipelineId) {
      toast.error("Select a training pipeline first.");
      return;
    }
    if (!configName.trim()) {
      toast.error("Configuration name is required.");
      return;
    }
    if (!baseModel) {
      toast.error("Select an uploaded base model first.");
      return;
    }
    setIsSavingConfig(true);
    const payload = {
      name: configName.trim(),
      base_model: baseModel,
      args: trainingArgs,
    };
    const result = selectedConfigId
      ? await updateTrainingConfig(selectedConfigId, payload)
      : await createTrainingConfig(activePipelineId, payload);
    setIsSavingConfig(false);
    if (!result.ok) {
      toast.error("Save failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success(selectedConfigId ? "Training configuration updated." : "Training configuration saved.");
    setConfigs((prev) => {
      if (selectedConfigId) {
        return prev.map((config) => (String(config.id) === String(selectedConfigId) ? result.data : config));
      }
      return [result.data, ...prev];
    });
    setSelectedConfigId(String(result.data.id));
    setIsConfigDialogOpen(false);
  };

  const handleQueueTraining = async () => {
    if (!activePipelineId || !selectedConfigId) {
      toast.error("Save or select a training configuration first.");
      return;
    }
    if (!selectedDatasetId) {
      toast.error("Select a training dataset first.");
      return;
    }
    setIsQueueingJob(true);
    const result = await createTrainingJob(
      activePipelineId,
      Number(selectedConfigId),
      Number(selectedDatasetId),
    );
    setIsQueueingJob(false);
    if (!result.ok) {
      toast.error("Queue failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Training job queued", {
      description: `Job #${result.data.id} is pending.`,
    });
    await refreshActivePipeline();
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
                Workspace
              </p>
              <h1 className="aas-page-title">Training</h1>
            </div>
          </div>
          <Dialog
            open={isPipelineDialogOpen}
            onOpenChange={(open) => {
              setIsPipelineDialogOpen(open);
              if (!open) {
                resetPipelineForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus />
                New pipeline
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create training pipeline</DialogTitle>
              </DialogHeader>
              <form className="space-y-5" onSubmit={handleCreatePipeline}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pipeline-name">Name</Label>
                    <Input
                      id="pipeline-name"
                      value={pipelineName}
                      onChange={(event) => setPipelineName(event.target.value)}
                      placeholder="Vehicle detector"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pipeline-task">Task</Label>
                    <NativeSelect
                      id="pipeline-task"
                      value={pipelineTask}
                      onChange={(event) => setPipelineTask(event.target.value)}
                    >
                      {TASK_OPTIONS.map((task) => (
                        <NativeSelectOption key={task} value={task}>
                          {task}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pipeline-description">Description</Label>
                  <Input
                    id="pipeline-description"
                    value={pipelineDescription}
                    onChange={(event) => setPipelineDescription(event.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Classes</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPipelineClasses((prev) => [
                          ...prev,
                          { name: "", index: prev.length },
                        ])
                      }
                    >
                      <Plus />
                      Add class
                    </Button>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {pipelineClasses.map((trainingClass, index) => (
                      <div key={`class-${index}`} className="grid grid-cols-[1fr_120px] gap-3">
                        <Input
                          value={trainingClass.name}
                          onChange={(event) => handleClassChange(index, "name", event.target.value)}
                          placeholder="person"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={trainingClass.index}
                          onChange={(event) =>
                            handleClassChange(index, "index", Number(event.target.value))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsPipelineDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreatingTrainingPipeline}>
                    {isCreatingTrainingPipeline ? "Creating..." : "Create pipeline"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden bg-background">
          <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Pipelines</h2>
              <Button size="icon" variant="ghost" onClick={fetchTrainingPipelines}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {isLoadingTrainingPipelines ? (
              <p className="text-sm text-slate-500">Loading pipelines...</p>
            ) : trainingPipelines.length === 0 ? (
              <p className="text-sm text-slate-500">No training pipelines yet.</p>
            ) : (
              <div className="space-y-2">
                {trainingPipelines.map((pipeline) => (
                  <button
                    key={pipeline.id}
                    type="button"
                    className={
                      "w-full rounded-lg border px-3 py-3 text-left text-sm transition " +
                      (String(pipeline.id) === activePipelineId
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                    onClick={() => {
                      setActivePipelineId(String(pipeline.id));
                      refreshActivePipeline(String(pipeline.id));
                    }}
                  >
                    <div className="font-medium">{pipeline.name}</div>
                    <div className={String(pipeline.id) === activePipelineId ? "text-slate-300" : "text-slate-500"}>
                      {pipeline.item_count || 0} images · {pipeline.job_count || 0} jobs
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="min-h-0 overflow-y-auto p-6">
            {!activePipeline ? (
              <Card className="border-dashed border-slate-200 bg-white p-10 text-center">
                <p className="text-sm text-slate-500">
                  Select or create a training pipeline to configure model training.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900">
                        {activePipeline.name}
                      </h2>
                      <Badge variant="secondary">{activePipeline.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {activePipeline.description || activePipeline.task}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleQueueTraining}
                    disabled={isQueueingJob || !selectedConfigId || !selectedDatasetId}
                  >
                    <Play />
                    {isQueueingJob ? "Queueing..." : "Start training"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-3 p-4 text-left"
                    onClick={() => setIsClassesDialogOpen(true)}
                  >
                    <Tags className="h-5 w-5 text-slate-500" />
                    <span>
                      <span className="block font-semibold text-slate-900">Classes</span>
                      <span className="block text-xs text-slate-500">{classRows.length} classes</span>
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-3 p-4 text-left"
                    onClick={() => setIsDatasetDialogOpen(true)}
                  >
                    <Database className="h-5 w-5 text-slate-500" />
                    <span>
                      <span className="block font-semibold text-slate-900">Dataset</span>
                      <span className="block truncate text-xs text-slate-500">
                        {selectedDataset ? `${selectedDataset.name} · ${selectedDatasetAssetCount} files` : "Select dataset"}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-3 p-4 text-left"
                    onClick={() => setIsSplitDialogOpen(true)}
                  >
                    <ListChecks className="h-5 w-5 text-slate-500" />
                    <span>
                      <span className="block font-semibold text-slate-900">Split</span>
                      <span className={splitTotal === 100 ? "block text-xs text-slate-500" : "block text-xs text-red-500"}>
                        {trainPercent}/{valPercent}/{testPercent}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-3 p-4 text-left"
                    onClick={() => setIsConfigDialogOpen(true)}
                  >
                    <Settings2 className="h-5 w-5 text-slate-500" />
                    <span>
                      <span className="block font-semibold text-slate-900">YOLO config</span>
                      <span className="block truncate text-xs text-slate-500">
                        {selectedConfig ? `Saved: ${selectedConfig.name}` : "Not saved"}
                      </span>
                    </span>
                  </Button>
                </div>

                <Dialog open={isClassesDialogOpen} onOpenChange={setIsClassesDialogOpen}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Classes</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="grid grid-cols-[90px_1fr_110px] bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                          <span>Index</span>
                          <span>Name</span>
                          <span className="text-right">Actions</span>
                        </div>
                        {classRows.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-slate-500">No classes yet.</div>
                        ) : (
                          classRows
                            .slice()
                            .sort((first, second) => first.index - second.index)
                            .map((trainingClass) => (
                              <div
                                key={trainingClass.id}
                                className="grid grid-cols-[90px_1fr_110px] items-center gap-2 border-t border-slate-200 px-3 py-2"
                              >
                                <Input
                                  type="number"
                                  min="0"
                                  value={trainingClass.index}
                                  onChange={(event) =>
                                    handleClassRowChange(trainingClass.id, "index", Number(event.target.value))
                                  }
                                  className="h-8"
                                />
                                <Input
                                  value={trainingClass.name}
                                  onChange={(event) =>
                                    handleClassRowChange(trainingClass.id, "name", event.target.value)
                                  }
                                  className="h-8"
                                />
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleSaveTrainingClass(trainingClass)}
                                    disabled={isSavingClass}
                                    aria-label={`Save ${trainingClass.name}`}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => handleDeleteTrainingClass(trainingClass)}
                                    disabled={isSavingClass}
                                    aria-label={`Delete ${trainingClass.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                      <div className="grid gap-2 md:grid-cols-[90px_1fr_auto]">
                        <Input
                          type="number"
                          min="0"
                          value={newClassIndex}
                          onChange={(event) => setNewClassIndex(Number(event.target.value))}
                          className="h-9"
                          aria-label="New class index"
                        />
                        <Input
                          value={newClassName}
                          onChange={(event) => setNewClassName(event.target.value)}
                          placeholder="New class name"
                          className="h-9"
                        />
                        <Button variant="outline" onClick={handleAddTrainingClass} disabled={isSavingClass}>
                          <Plus />
                          Add class
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDatasetDialogOpen} onOpenChange={setIsDatasetDialogOpen}>
                  <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Select training dataset</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="training-dataset">Dataset</Label>
                        <NativeSelect
                          id="training-dataset"
                          value={selectedDatasetId}
                          onChange={(event) => setSelectedDatasetId(event.target.value)}
                        >
                          <NativeSelectOption value="">Select dataset</NativeSelectOption>
                          {trainingDatasets.map((dataset) => (
                            <NativeSelectOption key={dataset.id} value={String(dataset.id)}>
                              {dataset.name} · {dataset.asset_count || 0} files
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        {selectedDataset
                          ? `${selectedDataset.name} has ${selectedDatasetAssetCount} image/label pair(s).`
                          : "Create datasets from the Training Datasets page before starting training."}
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={() => setIsDatasetDialogOpen(false)}>Done</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isSplitDialogOpen} onOpenChange={setIsSplitDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Train / validation / test split</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="train-percent">Train %</Label>
                        <Input id="train-percent" type="number" value={trainPercent} onChange={(event) => setTrainPercent(Number(event.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="val-percent">Val %</Label>
                        <Input id="val-percent" type="number" value={valPercent} onChange={(event) => setValPercent(Number(event.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="test-percent">Test %</Label>
                        <Input id="test-percent" type="number" value={testPercent} onChange={(event) => setTestPercent(Number(event.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="split-seed">Seed</Label>
                        <Input id="split-seed" type="number" value={splitSeed} onChange={(event) => setSplitSeed(Number(event.target.value))} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className={splitTotal === 100 ? "text-xs text-slate-500" : "text-xs text-red-500"}>
                        Current total: {splitTotal}%
                      </p>
                      <Button onClick={handleApplySplit} disabled={isApplyingSplit || splitTotal !== 100}>
                        {isApplyingSplit ? "Applying..." : "Apply split"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                  <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>YOLO training configuration</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="saved-config">Saved config</Label>
                          <NativeSelect id="saved-config" value={selectedConfigId} onChange={(event) => handleSelectConfig(event.target.value)}>
                            <NativeSelectOption value="">New config</NativeSelectOption>
                            {configs.map((config) => (
                              <NativeSelectOption key={config.id} value={String(config.id)}>
                                {config.name}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="config-name">Config name</Label>
                          <Input id="config-name" value={configName} onChange={(event) => setConfigName(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="base-model">Base model</Label>
                          <NativeSelect id="base-model" value={baseModel} onChange={(event) => setBaseModel(event.target.value)}>
                            <NativeSelectOption value="">Select uploaded model</NativeSelectOption>
                            {availableBaseModels.map((model) => (
                              <NativeSelectOption key={model.id} value={`ai_model:${model.id}`}>
                                {model.name}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="optimizer">Optimizer</Label>
                          <NativeSelect id="optimizer" value={trainingArgs.optimizer} onChange={(event) => setTrainingArg("optimizer", event.target.value)}>
                            {["auto", "SGD", "Adam", "AdamW", "NAdam", "RAdam", "RMSProp"].map((optimizer) => (
                              <NativeSelectOption key={optimizer} value={optimizer}>{optimizer}</NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>
                        {[
                          ["epochs", "Epochs"],
                          ["imgsz", "Image size"],
                          ["batch", "Batch"],
                          ["patience", "Patience"],
                          ["workers", "Workers"],
                          ["seed", "Seed"],
                          ["lr0", "Initial LR"],
                          ["lrf", "Final LR factor"],
                          ["momentum", "Momentum"],
                          ["weight_decay", "Weight decay"],
                          ["warmup_epochs", "Warmup epochs"],
                        ].map(([key, label]) => (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={`arg-${key}`}>{label}</Label>
                            <Input
                              id={`arg-${key}`}
                              type="number"
                              step={["lr0", "lrf", "momentum", "weight_decay", "warmup_epochs"].includes(key) ? "0.001" : "1"}
                              value={trainingArgs[key]}
                              onChange={(event) => setTrainingArg(key, Number(event.target.value))}
                            />
                          </div>
                        ))}
                        {["cos_lr", "cache", "pretrained", "amp"].map((key) => (
                          <div key={key} className="space-y-2">
                            <Label htmlFor={`arg-${key}`}>{key}</Label>
                            <NativeSelect
                              id={`arg-${key}`}
                              value={boolToText(trainingArgs[key])}
                              onChange={(event) => setTrainingArg(key, event.target.value === "true")}
                            >
                              <NativeSelectOption value="true">true</NativeSelectOption>
                              <NativeSelectOption value="false">false</NativeSelectOption>
                            </NativeSelect>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                        <p className="text-xs text-slate-500">
                          {selectedConfig ? `Saved config: ${selectedConfig.name}` : "This config is not saved yet."}
                          {selectedModel ? ` Base model: ${selectedModel.name}.` : ""}
                        </p>
                        <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
                          {isSavingConfig ? "Saving..." : selectedConfigId ? "Update config" : "Save config"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Card className="border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Training jobs</h3>
                    <Button variant="ghost" size="sm" onClick={() => refreshActivePipeline()}>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                  {jobs.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">No training jobs queued yet.</p>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                      {jobs.map((job) => (
                        <div key={job.id} className="grid gap-3 border-b border-slate-200 px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[70px_1fr_110px_100px_260px_380px] lg:items-center">
                          <span className="font-medium text-slate-900">#{job.id}</span>
                          <span className="text-slate-600">{job.config_detail?.name || "Config"}</span>
                          <Badge variant="secondary">{job.status}</Badge>
                          <span className="text-slate-500">{job.current_epoch}/{job.total_epochs || "?"}</span>
                          <NativeSelect
                            value={selectedArtifactByJob[job.id] || String(job.artifacts?.[0]?.id || "")}
                            onChange={(event) =>
                              setSelectedArtifactByJob((prev) => ({
                                ...prev,
                                [job.id]: event.target.value,
                              }))
                            }
                            disabled={!job.artifacts?.length}
                            className="h-9"
                          >
                            <NativeSelectOption value="">
                              {job.artifacts?.length ? "Select artifact" : "No artifacts"}
                            </NativeSelectOption>
                            {(job.artifacts || []).map((artifact) => (
                              <NativeSelectOption key={artifact.id} value={String(artifact.id)}>
                                {artifactTypeLabels[artifact.artifact_type] || artifact.artifact_type}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadSelectedArtifact(job)}
                              disabled={
                                !job.artifacts?.length ||
                                downloadingArtifactKey === `artifact-${selectedArtifactByJob[job.id] || job.artifacts?.[0]?.id}`
                              }
                            >
                              <Download className="h-4 w-4" />
                              Artifact
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadJobArtifactsZip(job)}
                              disabled={!job.artifacts?.length || downloadingArtifactKey === `job-${job.id}`}
                            >
                              <Download className="h-4 w-4" />
                              ZIP
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelTrainingJob(job)}
                              disabled={
                                !CANCELLABLE_TRAINING_STATUSES.has(job.status) ||
                                trainingJobActionKey === `cancel-${job.id}`
                              }
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestartTrainingJob(job)}
                              disabled={
                                !RESTARTABLE_TRAINING_STATUSES.has(job.status) ||
                                trainingJobActionKey === `restart-${job.id}`
                              }
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restart
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTrainingJob(job)}
                              disabled={job.status === "running" || trainingJobActionKey === `delete-${job.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {latestJob ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Latest job progress: {Math.round(latestJob.progress_percent || 0)}%
                    </p>
                  ) : null}
                </Card>
              </div>
            )}
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
