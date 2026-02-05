"use client";

import { Toaster } from "sonner";

export default function ToasterClient() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-2xl border border-slate-200 bg-white text-slate-900",
          title: "text-sm font-semibold",
          description: "text-xs text-slate-600",
        },
      }}
    />
  );
}
