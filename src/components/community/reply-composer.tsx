"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReply, withdrawOwn } from "@/lib/community/actions";
import { LIMITS, type ReportTarget } from "@/lib/community/terms";
import { Bezel } from "@/components/app/bezel";
import { Message01Icon } from "@/components/ui/message-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

export function ReplyComposer({ threadId }: { threadId: number }) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createReply({ threadId, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <Bezel className="mt-6" innerClassName="p-5">
      <form onSubmit={submit}>
        <label htmlFor="reply-body" className="sr-only">
          Your reply
        </label>
        <textarea
          id="reply-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={LIMITS.replyBody}
          rows={4}
          className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
          placeholder="Answer, or add what you know…"
        />

        {error && (
          <p role="alert" className="mt-3 text-xs font-bold text-status-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending || !body.trim()}
            {...handlers}
            className="group flex min-h-[42px] items-center gap-3 rounded-sm bg-accent-strong py-1.5 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Posting…" : "Reply"}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <Message01Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
            </span>
          </button>

          <p className="font-mono text-[10px] text-fg-subtle">
            {body.length} / {LIMITS.replyBody.toLocaleString("en-GB")} · posted
            under your display name
          </p>
        </div>
      </form>
    </Bezel>
  );
}

/**
 * Withdraw your own post.
 *
 * Sets `hidden_reason = 'author'` rather than deleting, so a report filed
 * against it still has something to review. The confirmation is deliberate and
 * inline rather than a `window.confirm`, which is unstyled, unthemeable and
 * blocks the whole tab.
 */
export function WithdrawButton({
  target,
  targetId,
}: {
  target: ReportTarget;
  targetId: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function withdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawOwn(target, targetId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-status-reach"
      >
        Withdraw
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <span className="font-mono text-[10px] text-fg-muted">Sure?</span>
      <button
        type="button"
        onClick={withdraw}
        disabled={pending}
        className="font-mono text-[10px] font-bold uppercase tracking-wider text-status-danger transition-opacity hover:opacity-80 disabled:opacity-60"
      >
        {pending ? "Withdrawing…" : "Yes, withdraw"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-foreground"
      >
        Keep
      </button>
      {error && (
        <span role="alert" className="text-[10px] font-bold text-status-danger">
          {error}
        </span>
      )}
    </span>
  );
}
