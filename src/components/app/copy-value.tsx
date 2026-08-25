"use client";

import { useState } from "react";

/**
 * A value with a copy button — an account number, a reference.
 *
 * Worth a component rather than an inline handler because the failure case
 * matters: `navigator.clipboard` is unavailable on an insecure origin and can
 * be refused by permission, and a button that silently does nothing on a page
 * asking somebody to transfer money is worse than one that says it could not.
 * The value stays selectable either way, so the fallback is always to read it.
 */
export function CopyValue({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <span className="select-all break-words font-mono text-sm font-bold text-foreground">
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-sm border border-border-strong px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Select it" : "Copy"}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === "copied"
          ? "Copied to clipboard"
          : state === "failed"
            ? "Could not copy — select the value and copy it manually"
            : ""}
      </span>
    </span>
  );
}
