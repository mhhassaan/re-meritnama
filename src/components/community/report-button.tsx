"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { reportContent } from "@/lib/community/actions";
import { LIMITS, REPORT_REASONS, type ReportTarget } from "@/lib/community/terms";
import { AlertIcon } from "@/components/icons/koboyo";

/**
 * Reporting, on every piece of user-written content.
 *
 * One report per person per item is enforced by a unique key in the database,
 * so a second attempt is refused rather than counted — three taps of a button
 * must not read as three people objecting.
 *
 * The reporter is never shown to the reported author: `content_reports`'
 * select policy is `own OR staff`, so the person being reported cannot see who
 * filed it or that anything was filed at all. That is not politeness, it is
 * what stops a report becoming an invitation to retaliate.
 *
 * Rendered through `createPortal` into `document.body`. `<Reveal>` carries a
 * transform, which would make it the containing block for this dialog's
 * `position: fixed` — a trap this project has hit twice.
 */
export function ReportButton({
  target,
  targetId,
  className = "",
}: {
  target: ReportTarget;
  targetId: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].id);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await reportContent({ target, targetId, reason, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  function close() {
    setOpen(false);
    // Reset only after closing, so the confirmation is readable first.
    setTimeout(() => {
      setDone(false);
      setError(null);
      setNote("");
      setReason(REPORT_REASONS[0].id);
    }, 200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-status-reach ${className}`}
      >
        Report
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            onClick={close}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Report this content"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-lg border border-border-strong bg-surface p-6 shadow-ambient sm:rounded-lg"
            >
              {done ? (
                <>
                  <p className="font-sans text-base font-bold text-foreground">
                    Reported. Thank you.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                    It is in the moderation queue. The person who wrote it is not
                    told who reported them, or that a report exists.
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="mt-6 w-full rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
                  >
                    Close
                  </button>
                </>
              ) : (
                <form onSubmit={submit}>
                  <div className="flex items-start gap-2.5">
                    <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
                    <div className="min-w-0">
                      <p className="font-sans text-base font-bold text-foreground">
                        What is wrong with this?
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                        A person reads every report. Nothing is hidden
                        automatically on a count of reports.
                      </p>
                    </div>
                  </div>

                  <fieldset className="mt-5 flex flex-col gap-2">
                    <legend className="sr-only">Reason</legend>
                    {REPORT_REASONS.map((r) => (
                      <label
                        key={r.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors ${
                          reason === r.id
                            ? "border-accent bg-accent-quiet"
                            : "border-border-strong hover:border-accent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={r.id}
                          checked={reason === r.id}
                          onChange={() => setReason(r.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-strong)]"
                        />
                        <span className="min-w-0">
                          <span className="block font-sans text-sm font-bold text-foreground">
                            {r.label}
                          </span>
                          {r.hint && (
                            <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
                              {r.hint}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  <label className="mt-5 block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                      Anything else (optional)
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={LIMITS.reportNote}
                      rows={3}
                      className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                      placeholder="What should a reviewer know?"
                    />
                  </label>

                  {error && (
                    <p role="alert" className="mt-3 text-xs font-bold text-status-danger">
                      {error}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={pending}
                      className="flex-1 rounded-sm bg-accent-strong px-4 py-2.5 text-sm font-bold text-fg-on-accent transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
                    >
                      {pending ? "Sending…" : "Send report"}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-sm border border-border-strong px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
