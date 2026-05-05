"use client";

import { CircleQuestionMark, Crosshair, Hand, Sparkles, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AnnotationToolSidebar({
  activeTool,
  hasAutoAnnotateConfig,
  onConfigureAutoAnnotate,
  onShowShortcuts,
  onToolChange,
}) {
  const toolButtonClass = (tool) =>
    activeTool === tool
      ? "bg-primary text-primary-foreground hover:bg-[#0f0000]"
      : "";

  return (
    <aside className="hidden w-16 flex-col items-center gap-3 border-r border-border bg-background py-4 md:flex">
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={activeTool === "draw" ? "secondary" : "ghost"}
                className={toolButtonClass("draw")}
                onClick={() => onToolChange("draw")}
              >
                <Square className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Draw bounding box</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={activeTool === "select" ? "secondary" : "ghost"}
                className={toolButtonClass("select")}
                onClick={() => onToolChange("select")}
              >
                <Crosshair className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Select or move box</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={activeTool === "pan" ? "secondary" : "ghost"}
                className={toolButtonClass("pan")}
                onClick={() => onToolChange("pan")}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Pan canvas</TooltipContent>
          </Tooltip>

          <div className="h-px w-8 bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onConfigureAutoAnnotate}
                className={
                  hasAutoAnnotateConfig
                    ? "text-emerald-600 hover:text-emerald-700"
                    : ""
                }
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Configure auto-annotate</TooltipContent>
          </Tooltip>

          <div className="mt-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onShowShortcuts}
                  aria-label="Show keyboard shortcuts"
                >
                  <CircleQuestionMark className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Keyboard shortcuts</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
