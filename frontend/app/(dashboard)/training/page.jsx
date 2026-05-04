"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Plus, RefreshCcw, Save, Trash2, Upload } from "lucide-react";
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

const boolToText = (value) => (value ? "true" : "false");

export default function TrainingPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    applyTrainingSplit,
    createTrainingConfig,
    createTrainingClass,
    createTrainingJob,
    createTrainingPipeline,
    deleteTrainingClass,
    fetchTrainingConfigs,
    fetchTrainingItems,
    fetchTrainingJobs,
    fetchTrainingPipeline,
    fetchTrainingPipelines,
    isCreatingTrainingPipeline,
    isLoadingTrainingPipelines,
    trainingPipelines,
    updateTrainingClass,
    uploadTrainingItems,
  } = useApiStore();

  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
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
  const [items, setItems] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [imageFiles, setImageFiles] = useState(null);
  const [labelFiles, setLabelFiles] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [trainPercent, setTrainPercent] = useState(80);
  const [valPercent, setValPercent] = useState(10);
  const [testPercent, setTestPercent] = useState(10);
  const [splitSeed, setSplitSeed] = useState(42);
  const [isApplyingSplit, setIsApplyingSplit] = useState(false);
  const [configName, setConfigName] = useState("Default training");
  const [baseModel, setBaseModel] = useState("yolo11n.pt");
  const [trainingArgs, setTrainingArgs] = useState(DEFAULT_TRAINING_ARGS);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isQueueingJob, setIsQueueingJob] = useState(false);

  const splitTotal = Number(trainPercent) + Number(valPercent) + Number(testPercent);
  const latestJob = jobs[0];
  const itemCounts = useMemo(() => {
    return items.reduce(
      (counts, item) => ({
        ...counts,
        [item.split]: (counts[item.split] || 0) + 1,
      }),
      { train: 0, val: 0, test: 0, unassigned: 0 },
    );
  }, [items]);

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
      const [pipelineResult, itemsResult, configsResult, jobsResult] = await Promise.all([
        fetchTrainingPipeline(pipelineId),
        fetchTrainingItems(pipelineId),
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
      if (itemsResult.ok) {
        setItems(itemsResult.data || []);
      }
      if (configsResult.ok) {
        setConfigs(configsResult.data || []);
        setSelectedConfigId((prev) => prev || (configsResult.data?.[0]?.id ? String(configsResult.data[0].id) : ""));
      }
      if (jobsResult.ok) {
        setJobs(jobsResult.data || []);
      }
    },
    [
      activePipelineId,
      fetchTrainingConfigs,
      fetchTrainingItems,
      fetchTrainingJobs,
      fetchTrainingPipeline,
    ],
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    fetchTrainingPipelines();
  }, [accessToken, fetchTrainingPipelines]);

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

  const handleUploadItems = async () => {
    if (!activePipelineId) {
      toast.error("Select a training pipeline first.");
      return;
    }
    if (!imageFiles?.length) {
      toast.error("Select image files first.");
      return;
    }
    setIsUploading(true);
    const result = await uploadTrainingItems(activePipelineId, imageFiles, labelFiles || []);
    setIsUploading(false);
    if (!result.ok) {
      toast.error("Upload failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Dataset uploaded", {
      description: `${result.data.length} image(s) added.`,
    });
    setImageFiles(null);
    setLabelFiles(null);
    await refreshActivePipeline();
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
    await refreshActivePipeline();
  };

  const setTrainingArg = (key, value) => {
    setTrainingArgs((prev) => ({ ...prev, [key]: value }));
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
    setIsSavingConfig(true);
    const result = await createTrainingConfig(activePipelineId, {
      name: configName.trim(),
      base_model: baseModel.trim() || "yolo11n.pt",
      args: trainingArgs,
    });
    setIsSavingConfig(false);
    if (!result.ok) {
      toast.error("Save failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("Training configuration saved.");
    setConfigs((prev) => [result.data, ...prev]);
    setSelectedConfigId(String(result.data.id));
  };

  const handleQueueTraining = async () => {
    if (!activePipelineId || !selectedConfigId) {
      toast.error("Save or select a training configuration first.");
      return;
    }
    setIsQueueingJob(true);
    const result = await createTrainingJob(activePipelineId, Number(selectedConfigId));
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
        <header className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Workspace
              </p>
              <h1 className="text-xl font-semibold text-slate-900">Training</h1>
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

        <main className="grid min-h-0 flex-1 grid-cols-[320px_1fr] overflow-hidden bg-slate-50">
          <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Pipelines</h2>
              <Button size="icon" variant="ghost" onClick={fetchTrainingPipelines}>
                <RefreshCcw className="h-4 w-4" />
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
                <Card className="border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {activePipeline.task}
                      </p>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {activePipeline.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {activePipeline.description || "No description"}
                      </p>
                    </div>
                    <Badge variant="secondary">{activePipeline.status}</Badge>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Classes</h3>
                      <Badge variant="outline">{classRows.length} total</Badge>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="grid grid-cols-[90px_1fr_110px] bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                        <span>Index</span>
                        <span>Name</span>
                        <span className="text-right">Actions</span>
                      </div>
                      {classRows.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500">
                          No classes yet.
                        </div>
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
                                  handleClassRowChange(
                                    trainingClass.id,
                                    "index",
                                    Number(event.target.value),
                                  )
                                }
                                className="h-8"
                              />
                              <Input
                                value={trainingClass.name}
                                onChange={(event) =>
                                  handleClassRowChange(
                                    trainingClass.id,
                                    "name",
                                    event.target.value,
                                  )
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
                      <Button
                        variant="outline"
                        onClick={handleAddTrainingClass}
                        disabled={isSavingClass}
                      >
                        <Plus />
                        Add class
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="border-slate-200 bg-white p-5">
                  <h3 className="text-base font-semibold text-slate-900">Dataset upload</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="training-images">Images</Label>
                      <Input
                        id="training-images"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(event) => setImageFiles(event.target.files)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="training-labels">YOLO labels</Label>
                      <Input
                        id="training-labels"
                        type="file"
                        multiple
                        accept=".txt"
                        onChange={(event) => setLabelFiles(event.target.files)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleUploadItems} disabled={isUploading}>
                        <Upload />
                        {isUploading ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">{items.length} total</Badge>
                    <Badge variant="outline">{itemCounts.train} train</Badge>
                    <Badge variant="outline">{itemCounts.val} val</Badge>
                    <Badge variant="outline">{itemCounts.test} test</Badge>
                    <Badge variant="outline">{itemCounts.unassigned} unassigned</Badge>
                  </div>
                </Card>

                <Card className="border-slate-200 bg-white p-5">
                  <h3 className="text-base font-semibold text-slate-900">Train / val / test split</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-5">
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
                    <div className="flex items-end">
                      <Button onClick={handleApplySplit} disabled={isApplyingSplit || splitTotal !== 100}>
                        {isApplyingSplit ? "Applying..." : "Apply split"}
                      </Button>
                    </div>
                  </div>
                  <p className={splitTotal === 100 ? "mt-2 text-xs text-slate-500" : "mt-2 text-xs text-red-500"}>
                    Current total: {splitTotal}%
                  </p>
                </Card>

                <Card className="border-slate-200 bg-white p-5">
                  <h3 className="text-base font-semibold text-slate-900">YOLO training configuration</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="config-name">Config name</Label>
                      <Input id="config-name" value={configName} onChange={(event) => setConfigName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="base-model">Base model</Label>
                      <Input id="base-model" value={baseModel} onChange={(event) => setBaseModel(event.target.value)} placeholder="yolo11n.pt" />
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
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
                      {isSavingConfig ? "Saving..." : "Save config"}
                    </Button>
                    <NativeSelect
                      value={selectedConfigId}
                      onChange={(event) => setSelectedConfigId(event.target.value)}
                      className="w-64"
                    >
                      <NativeSelectOption value="">Select saved config</NativeSelectOption>
                      {configs.map((config) => (
                        <NativeSelectOption key={config.id} value={String(config.id)}>
                          {config.name} · {config.base_model}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Button variant="secondary" onClick={handleQueueTraining} disabled={isQueueingJob || !selectedConfigId}>
                      <Play />
                      {isQueueingJob ? "Queueing..." : "Start training"}
                    </Button>
                  </div>
                </Card>

                <Card className="border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Training jobs</h3>
                    <Button variant="ghost" size="sm" onClick={() => refreshActivePipeline()}>
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                  {jobs.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">No training jobs queued yet.</p>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                      {jobs.map((job) => (
                        <div key={job.id} className="grid grid-cols-[90px_1fr_120px_120px] items-center border-b border-slate-200 px-4 py-3 text-sm last:border-b-0">
                          <span className="font-medium text-slate-900">#{job.id}</span>
                          <span className="text-slate-600">{job.config_detail?.name || "Config"}</span>
                          <Badge variant="secondary">{job.status}</Badge>
                          <span className="text-slate-500">{job.current_epoch}/{job.total_epochs || "?"}</span>
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
