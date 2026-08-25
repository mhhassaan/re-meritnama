"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  dismissReports,
  hideContent,
  restoreContent,
} from "@/lib/community/moderation-actions";
import type { ReportTarget } from "@/lib/community/terms";

/**
 * The three decisions a reviewer can make.
 *
 * Deliberately three buttons and not two. "Hide" and "Restore" are opposites,
 * but "leave it and close the reports" is a real and common outcome — most
 * reports on a working forum are about something that turns out to be fine, and
 * without a way to record that, the queue only ever grows.
 *
 * Each one also resolves the reports it acted on, so the queue records a
 * decision rather than only that somebody looked.
 */
export function ReportActions({
  target,
  targetId,
  hidden,
  hasOpenReports,
}: {
  target: ReportTarget;
  targetId: number;
  hidden: boolean;
  hasOpenReports: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "That did not work.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hidden ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => restoreContent(target, targetId))}
          className="rounded-sm border border-status-safe/50 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-status-safe transition-colors hover:bg-status-safe/10 disabled:opacity-60"
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => hideContent(target, targetId))}
          className="rounded-sm border border-status-danger/50 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60"
        >
          Hide
        </button>
      )}

      {hasOpenReports && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => dismissReports(target, targetId))}
          className="rounded-sm border border-border-strong px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-60"
        >
          Leave it, close reports
        </button>
      )}

      {pending && (
        <span className="font-mono text-[10px] text-fg-subtle">Working…</span>
      )}

      {error && (
        <span role="alert" className="text-[10px] font-bold text-status-danger">
          {error}
        </span>
      )}
    </div>
  );
}
