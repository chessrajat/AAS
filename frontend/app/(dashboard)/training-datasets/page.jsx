"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Plus, RefreshCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import HomeSidebar from "../../components/HomeSidebar";
import { useAuthStore } from "../../stores/authStore";
import { useApiStore } from "../../stores/apiStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TrainingDatasetsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    createTrainingDataset,
    deleteTrainingDataset,
    fetchTrainingDatasetAssets,
    fetchTrainingDatasets,
    isCreatingTrainingDataset,
    isLoadingTrainingDatasets,
    trainingDatasets,
    uploadTrainingDatasetAssets,
    uploadTrainingDatasetZip,
  } = useApiStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  const [activeDatasetId, setActiveDatasetId] = useState("");
  const [assets, setAssets] = useState([]);
  const [assetTotalCount, setAssetTotalCount] = useState(0);
  const [assetNextPage, setAssetNextPage] = useState(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isLoadingMoreAssets, setIsLoadingMoreAssets] = useState(false);
  const [imageFiles, setImageFiles] = useState(null);
  const [labelFiles, setLabelFiles] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isUploadingZip, setIsUploadingZip] = useState(false);
  const [uploadMode, setUploadMode] = useState("files");

  const activeDataset = useMemo(
    () => trainingDatasets.find((dataset) => String(dataset.id) === String(activeDatasetId)),
    [activeDatasetId, trainingDatasets],
  );

  const refreshDatasets = async () => {
    const result = await fetchTrainingDatasets();
    if (result.ok && !activeDatasetId && result.data?.[0]?.id) {
      setActiveDatasetId(String(result.data[0].id));
    }
  };

  const applyAssetPage = (data, append = false) => {
    const nextResults = data?.results || [];
    setAssets((prev) => (append ? [...prev, ...nextResults] : nextResults));
    setAssetTotalCount(data?.count || 0);
    setAssetNextPage(data?.next_page || null);
  };

  const refreshAssets = async (datasetId = activeDatasetId) => {
    if (!datasetId) {
      setAssets([]);
      setAssetTotalCount(0);
      setAssetNextPage(null);
      return;
    }
    setIsLoadingAssets(true);
    const result = await fetchTrainingDatasetAssets(datasetId, 1);
    setIsLoadingAssets(false);
    if (result.ok) {
      applyAssetPage(result.data);
    }
  };

  const handleLoadMoreAssets = async () => {
    if (!activeDatasetId || !assetNextPage) {
      return;
    }
    setIsLoadingMoreAssets(true);
    const result = await fetchTrainingDatasetAssets(activeDatasetId, assetNextPage);
    setIsLoadingMoreAssets(false);
    if (!result.ok) {
      toast.error("Unable to load more files", {
        description: result.error || "Please try again.",
      });
      return;
    }
    applyAssetPage(result.data, true);
  };

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let isMounted = true;
    fetchTrainingDatasets().then((result) => {
      if (!isMounted) {
        return;
      }
      if (result.ok && !activeDatasetId && result.data?.[0]?.id) {
        setActiveDatasetId(String(result.data[0].id));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [accessToken, activeDatasetId, fetchTrainingDatasets]);

  useEffect(() => {
    let isMounted = true;
    if (!activeDatasetId) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setAssets([]);
          setAssetTotalCount(0);
          setAssetNextPage(null);
        }
      });
      return () => {
        isMounted = false;
      };
    }
    fetchTrainingDatasetAssets(activeDatasetId, 1).then((result) => {
      if (!isMounted) {
        return;
      }
      if (result.ok) {
        const nextResults = result.data?.results || [];
        setAssets(nextResults);
        setAssetTotalCount(result.data?.count || 0);
        setAssetNextPage(result.data?.next_page || null);
      }
      setIsLoadingAssets(false);
    });
    Promise.resolve().then(() => {
      if (isMounted) {
        setIsLoadingAssets(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeDatasetId, fetchTrainingDatasetAssets]);

  const resetCreateForm = () => {
    setDatasetName("");
    setDatasetDescription("");
  };

  const handleCreateDataset = async (event) => {
    event.preventDefault();
    const name = datasetName.trim();
    if (!name) {
      toast.error("Dataset name is required.");
      return;
    }
    const result = await createTrainingDataset({
      name,
      description: datasetDescription.trim(),
    });
    if (!result.ok) {
      toast.error("Dataset creation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setActiveDatasetId(String(result.data.id));
    setIsCreateOpen(false);
    resetCreateForm();
    toast.success("Training dataset created", {
      description: result.data.name,
    });
  };

  const handleConfirmDeleteDataset = async () => {
    if (!datasetToDelete) {
      return;
    }
    const result = await deleteTrainingDataset(datasetToDelete.id);
    if (!result.ok) {
      toast.error("Delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    const nextDatasets = trainingDatasets.filter((item) => item.id !== datasetToDelete.id);
    setActiveDatasetId(nextDatasets[0]?.id ? String(nextDatasets[0].id) : "");
    toast.success("Training dataset deleted", {
      description: datasetToDelete.name,
    });
    setDatasetToDelete(null);
  };

  const handleUploadFiles = async () => {
    if (!activeDatasetId) {
      toast.error("Select a dataset first.");
      return;
    }
    if (!imageFiles?.length) {
      toast.error("Select image files first.");
      return;
    }
    if (!labelFiles?.length) {
      toast.error("Select label files first.");
      return;
    }
    setIsUploadingFiles(true);
    const result = await uploadTrainingDatasetAssets(activeDatasetId, imageFiles, labelFiles);
    setIsUploadingFiles(false);
    if (!result.ok) {
      toast.error("Dataset upload failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setImageFiles(null);
    setLabelFiles(null);
    await refreshAssets();
    await fetchTrainingDatasets();
    toast.success("Files uploaded", {
      description: `${result.data.length} pair(s) added.`,
    });
  };

  const handleUploadZip = async () => {
    if (!activeDatasetId) {
      toast.error("Select a dataset first.");
      return;
    }
    if (!zipFile) {
      toast.error("Select a ZIP archive first.");
      return;
    }
    setIsUploadingZip(true);
    const result = await uploadTrainingDatasetZip(activeDatasetId, zipFile);
    setIsUploadingZip(false);
    if (!result.ok) {
      toast.error("ZIP upload failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    setZipFile(null);
    await refreshAssets();
    await fetchTrainingDatasets();
    toast.success("ZIP uploaded", {
      description: `${result.data.length} pair(s) added.`,
    });
  };

  if (!accessToken) {
    return null;
  }

  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <main className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <Database className="h-5 w-5 text-slate-500" />
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Training Datasets</h1>
                  <p className="text-sm text-slate-500">Reusable image and label sets</p>
                </div>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus />
                    Create dataset
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create training dataset</DialogTitle>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleCreateDataset}>
                    <div className="space-y-2">
                      <Label htmlFor="dataset-name">Name</Label>
                      <Input
                        id="dataset-name"
                        value={datasetName}
                        onChange={(event) => setDatasetName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataset-description">Description</Label>
                      <Input
                        id="dataset-description"
                        value={datasetDescription}
                        onChange={(event) => setDatasetDescription(event.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={isCreatingTrainingDataset}>
                      {isCreatingTrainingDataset ? "Creating..." : "Create"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <div className="grid gap-5 p-5 lg:grid-cols-[320px_1fr]">
            <Card className="border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Datasets</h2>
                <Button variant="ghost" size="icon" onClick={refreshDatasets}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {isLoadingTrainingDatasets ? (
                  <p className="text-sm text-slate-500">Loading datasets...</p>
                ) : trainingDatasets.length === 0 ? (
                  <p className="text-sm text-slate-500">No training datasets yet.</p>
                ) : (
                  trainingDatasets.map((dataset) => {
                    const isActive = String(dataset.id) === String(activeDatasetId);
                    return (
                      <div
                        key={dataset.id}
                        className={`group flex w-full items-start gap-2 rounded-md border px-3 py-3 transition ${
                          isActive
                            ? "border-slate-900 bg-slate-100"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setActiveDatasetId(String(dataset.id))}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-slate-900">
                              {dataset.name}
                            </span>
                            <Badge variant="secondary">{dataset.asset_count || 0}</Badge>
                          </div>
                          {dataset.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {dataset.description}
                            </p>
                          ) : null}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600"
                          onClick={() => setDatasetToDelete(dataset)}
                          aria-label={`Delete ${dataset.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <section className="space-y-5">
              {!activeDataset ? (
                <Card className="border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Select or create a dataset.
                </Card>
              ) : (
                <>
                  <Card className="border-slate-200 bg-white p-5">
                    <div className="grid gap-6 lg:grid-cols-[160px_1fr]">
                      <div>
                        <p className="text-xs font-bold uppercase leading-5 tracking-wide text-slate-600">
                          Configure<br />Upload
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {assetTotalCount || assets.length} pairs
                          </Badge>
                        </div>
                      </div>
                      <Tabs value={uploadMode} onValueChange={setUploadMode} className="w-full">
                        <TabsList className="grid h-12 w-full max-w-md grid-cols-2 rounded-full bg-slate-100 p-1">
                          <TabsTrigger
                            value="files"
                            className="rounded-full data-[state=active]:bg-black data-[state=active]:text-white"
                          >
                            Individual Files
                          </TabsTrigger>
                          <TabsTrigger
                            value="zip"
                            className="rounded-full data-[state=active]:bg-black data-[state=active]:text-white"
                          >
                            ZIP Archive
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="files" className="mt-6 space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="dataset-images" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Select images
                            </Label>
                            <label
                              htmlFor="dataset-images"
                              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 hover:bg-slate-100"
                            >
                              <Upload className="mb-2 h-6 w-6 text-slate-500" />
                              <span>
                                {imageFiles?.length
                                  ? `${imageFiles.length} image file(s) selected`
                                  : "Drop or browse JPG/PNG files"}
                              </span>
                            </label>
                            <Input
                              id="dataset-images"
                              type="file"
                              multiple
                              accept="image/*"
                              className="sr-only"
                              onChange={(event) => setImageFiles(event.target.files)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="dataset-labels" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Label mapping (.txt)
                            </Label>
                            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm">
                              <span className="min-w-0 flex-1 truncate text-slate-500">
                                {labelFiles?.length
                                  ? `${labelFiles.length} label file(s) selected`
                                  : "No label file selected"}
                              </span>
                              <label htmlFor="dataset-labels" className="cursor-pointer font-semibold text-slate-900 underline">
                                Browse
                              </label>
                            </div>
                            <Input
                              id="dataset-labels"
                              type="file"
                              multiple
                              accept=".txt"
                              className="sr-only"
                              onChange={(event) => setLabelFiles(event.target.files)}
                            />
                          </div>
                          <Button
                            className="h-14 w-full rounded-full bg-black text-base font-semibold text-white hover:bg-slate-900"
                            onClick={handleUploadFiles}
                            disabled={isUploadingFiles}
                          >
                            <Upload className="h-5 w-5" />
                            {isUploadingFiles ? "Uploading..." : "Upload Dataset"}
                          </Button>
                        </TabsContent>
                        <TabsContent value="zip" className="mt-6 space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="dataset-zip" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              ZIP archive
                            </Label>
                            <label
                              htmlFor="dataset-zip"
                              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 hover:bg-slate-100"
                            >
                              <Upload className="mb-2 h-6 w-6 text-slate-500" />
                              <span>{zipFile ? zipFile.name : "Drop or browse dataset ZIP"}</span>
                            </label>
                            <Input
                              id="dataset-zip"
                              type="file"
                              accept=".zip,application/zip,application/x-zip-compressed"
                              className="sr-only"
                              onChange={(event) => setZipFile(event.target.files?.[0] || null)}
                            />
                          </div>
                          <Button
                            className="h-14 w-full rounded-full bg-black text-base font-semibold text-white hover:bg-slate-900"
                            onClick={handleUploadZip}
                            disabled={isUploadingZip}
                          >
                            <Upload className="h-5 w-5" />
                            {isUploadingZip ? "Uploading..." : "Upload Dataset"}
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </Card>

                  <Card className="border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-slate-900">Dataset files</h3>
                      <Button variant="ghost" size="sm" onClick={() => refreshAssets()}>
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                    {isLoadingAssets ? (
                      <p className="mt-4 text-sm text-slate-500">Loading files...</p>
                    ) : assets.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-500">No files uploaded yet.</p>
                    ) : (
                      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                        <div className="max-h-[320px] overflow-y-auto">
                          {assets.map((asset) => (
                            <div
                              key={asset.id}
                              className="grid gap-3 border-b border-slate-200 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_110px]"
                            >
                              <span className="truncate font-medium text-slate-900">
                                {asset.original_image_name}
                              </span>
                              <span className="truncate text-slate-600">
                                {asset.original_label_name}
                              </span>
                              <span className="text-slate-500">
                                {asset.width || "?"}x{asset.height || "?"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {assetNextPage ? (
                          <div className="border-t border-slate-200 p-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleLoadMoreAssets}
                              disabled={isLoadingMoreAssets}
                            >
                              {isLoadingMoreAssets ? "Loading..." : "Load more"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </section>
          </div>
          <AlertDialog
            open={Boolean(datasetToDelete)}
            onOpenChange={(open) => {
              if (!open) {
                setDatasetToDelete(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the dataset and its uploaded image/label pairs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDeleteDataset}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
