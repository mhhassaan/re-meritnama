"use client";

import { useState } from "react";
import type { Prediction } from "@/lib/predict/predict";
import { Download01Icon } from "@/components/ui/download-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";
import {
  PredictionReport,
  type ReportContext,
} from "./prediction-report";

/**
 * Downloads the prediction as a PDF, matching the original's export.
 *
 * Rendered in the browser via Takumi's WASM build. That is a deliberate choice
 * rather than the easier server route: the merit score is the entire content of
 * this document, and generating it server-side would mean posting a candidate's
 * score to us for no reason. Nothing leaves the device.
 *
 * The engine is ~2 MB of WebAssembly, so it is imported dynamically on click
 * rather than in the page bundle — nobody who never exports should pay for it.
 */
export function ExportReportButton({
  context,
  predictions,
}: {
  context: ReportContext;
  predictions: Prediction[];
}) {
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const { ref: icon, handlers } = useActionIcon();

  async function download() {
    setState("working");
    try {
      // NOT the bare `takumi-pdf` entry. Turbopack resolves that to the Vite
      // bundle, which imports a `.wasm_.loader.mjs` shim it cannot follow and
      // the build fails outright. `no-init` is the plain module, and the wasm
      // binary is fetched from its own URL export and initialised by hand.
      const [{ render, default: init }, { default: wasmUrl }] =
        await Promise.all([
          import("takumi-pdf/no-init"),
          import("takumi-pdf/wasm-url"),
        ]);

      await init({ module_or_path: wasmUrl });

      const bytes = await render(
        <PredictionReport context={context} predictions={predictions} />,
        // `size`, not `format` — and an explicit paper colour, since an
        // unset background leaves the page transparent in some viewers.
        { size: "a4", backgroundColor: "#ffffff" }
      );

      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "meritnama-prediction-report.pdf";
      link.click();

      // Released on the next tick; revoking immediately can cancel the download
      // in some browsers before it has read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("idle");
    } catch (error) {
      console.error("PDF export failed", error);
      setState("failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={state === "working"}
        title="Download this prediction as a PDF report"
        {...handlers}
        className="flex min-h-[38px] items-center gap-2 rounded-sm border border-border-strong bg-surface px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors duration-[150ms] hover:border-accent hover:text-foreground disabled:cursor-wait disabled:opacity-60"
      >
        <Download01Icon ref={icon} size={ICON_SIZE_SM} />
        {state === "working" ? "Preparing…" : "Export PDF"}
      </button>

      {state === "failed" && (
        <span className="font-mono text-[11px] text-status-danger">
          Export failed — see console.
        </span>
      )}
    </div>
  );
}
