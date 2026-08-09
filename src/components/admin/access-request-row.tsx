"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, CheckCircle2, FileText, Send, X } from "lucide-react";
import { formatDate } from "@/lib/format/date";
import {
  approveAccessRequest,
  getPaymentProofUrl,
  markPaymentVerified,
  rejectAccessRequest,
  resendAccessLink,
} from "@/app/(admin)/admin/actions";

type Request = {
  email: string;
  applicant_id: number | null;
  induction: number;
  name_full: string | null;
  message: string | null;
  status: string;
  payment_declared: boolean;
  payment_amount_pkr: number | null;
  payment_reference: string | null;
  payment_verified: boolean;
  proof_object_path: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-status-reach text-status-reach bg-status-reach-quiet",
  approved: "border-status-safe text-status-safe bg-status-safe-quiet",
  rejected: "border-status-danger text-status-danger bg-status-danger-quiet",
};

export function AccessRequestRow({ request }: { request: Request }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const run = (action: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(
        result.ok
          ? { kind: "ok", text: result.message ?? "Done." }
          : { kind: "error", text: result.error ?? "Something went wrong." }
      );
    });
  };

  // Opened in a new tab rather than embedded: the signed URL expires in five
  // minutes, and an <img> in the page would keep it in the DOM and in the
  // browser cache long after that.
  const viewProof = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await getPaymentProofUrl(request.email, request.induction);
      if (result.ok) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setFeedback({ kind: "error", text: result.error });
      }
    });
  };

  const isPending = request.status === "pending";

  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans text-sm font-bold text-foreground">
            {request.name_full ?? "Unnamed candidate"}
          </p>
          <p className="mt-0.5 font-mono text-xs text-fg-muted">{request.email}</p>
          <p className="mt-0.5 font-mono text-xs text-fg-subtle">
            Induction {request.induction} · Applicant ID {request.applicant_id ?? "—"} ·{" "}
            {formatDate(request.created_at)}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
            STATUS_STYLES[request.status] ?? "border-border text-fg-muted"
          }`}
        >
          {request.status}
        </span>
      </div>

      {request.message && (
        <p className="mt-3 rounded-sm border border-border bg-surface-sunken p-2.5 text-xs leading-relaxed text-fg-muted">
          {request.message}
        </p>
      )}

      {request.payment_declared && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-mono text-fg-muted">
            PKR {request.payment_amount_pkr ?? "—"}
          </span>
          {request.payment_reference && (
            <span className="font-mono text-fg-subtle">
              ref {request.payment_reference}
            </span>
          )}
          {request.proof_object_path && (
            <button
              type="button"
              disabled={pending}
              onClick={viewProof}
              className="flex items-center gap-1.5 rounded-sm border border-border-strong px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-foreground disabled:opacity-60"
            >
              <FileText className="h-3 w-3" />
              <span>view proof</span>
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => markPaymentVerified(request.email, request.induction, !request.payment_verified))
            }
            className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60 ${
              request.payment_verified
                ? "border-status-safe text-status-safe"
                : "border-border-strong text-fg-muted hover:text-foreground"
            }`}
          >
            {request.payment_verified ? "payment verified" : "mark payment verified"}
          </button>
        </div>
      )}

      {feedback && (
        <p
          className={`mt-3 flex items-start gap-2 rounded-sm border p-2.5 text-xs ${
            feedback.kind === "ok"
              ? "border-status-safe bg-status-safe-quiet text-status-safe"
              : "border-status-danger bg-status-danger-quiet text-status-danger"
          }`}
        >
          {feedback.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </p>
      )}

      {request.status === "approved" && (
        <div className="mt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resendAccessLink(request.email, request.induction))}
            className="flex min-h-[36px] items-center gap-2 rounded-sm border border-border-strong px-4 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:text-foreground disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{pending ? "Sending…" : "Resend set-password link"}</span>
          </button>
        </div>
      )}

      {isPending && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveAccessRequest(request.email, request.induction))}
            className="flex min-h-[36px] items-center gap-2 rounded-sm bg-accent-strong px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{pending ? "Working…" : "Approve & send invite"}</span>
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rejectAccessRequest(request.email, request.induction))}
            className="flex min-h-[36px] items-center gap-2 rounded-sm border border-border-strong px-4 py-1.5 text-xs font-bold text-fg-muted transition-colors hover:text-status-danger disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reject</span>
          </button>
        </div>
      )}
    </li>
  );
}
