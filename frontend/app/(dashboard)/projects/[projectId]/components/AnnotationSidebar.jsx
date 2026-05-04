"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AnnotationSidebar({
  activeLabelId,
  annotationCount,
  annotations,
  hiddenAnnotationIdSet,
  isLoadingAnnotations,
  isLoadingProject,
  onAddLabel,
  onDeleteAnnotation,
  onLabelClick,
  onSelectAnnotation,
  onToggleAnnotationVisibility,
  projectLabels,
  selectedAnnotationId,
}) {
  const hasLabels = projectLabels.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="flex min-h-0 flex-[1.1] flex-col border-b border-border">
        <div className="flex items-center justify-between px-4 pb-2 pt-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">
            Objects
          </h2>
          <span className="text-xs text-muted-foreground">
            {annotationCount} items
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 px-4 pb-4">
            {annotations.length === 0 ? (
              <div className="border border-border bg-muted p-3 text-sm text-muted-foreground">
                {isLoadingAnnotations
                  ? "Loading annotations..."
                  : "No annotations yet for this image."}
              </div>
            ) : (
              annotations.map((annotation) => {
                const label = projectLabels.find(
                  (item) => item.id === annotation.project_class,
                );
                const labelColor = label?.color || "#3b82f6";
                const isSelected = selectedAnnotationId === annotation.id;
                const isHidden = hiddenAnnotationIdSet.has(annotation.id);

                return (
                  <div
                    key={annotation.id}
                    className={`flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm transition ${
                      isSelected
                        ? "bg-secondary font-semibold text-foreground"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: labelColor }}
                    />
                    <button
                      type="button"
                      className={`min-w-0 flex-1 truncate text-left ${
                        isHidden ? "text-muted-foreground" : ""
                      }`}
                      onClick={() => onSelectAnnotation(annotation.id)}
                    >
                      {label?.name || `Annotation_${annotation.id}`}
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => onToggleAnnotationVisibility(annotation.id)}
                      aria-label={isHidden ? "Show annotation" : "Hide annotation"}
                    >
                      {isHidden ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => onDeleteAnnotation(annotation.id)}
                      aria-label="Delete annotation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </section>

      <section className="flex-1 border-b border-border px-4 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">
            Labels
          </h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={onAddLabel}
            aria-label="Add label"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!hasLabels ? (
            <p className="text-sm text-muted-foreground">
              {isLoadingProject
                ? "Loading labels..."
                : "No labels defined for this project yet."}
            </p>
          ) : (
            projectLabels.map((label) => {
              const isActive = activeLabelId === label.id;
              return (
                <button
                  key={label.id}
                  type="button"
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${
                    isActive
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                  onClick={() => onLabelClick(label)}
                >
                  {label.name}
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
