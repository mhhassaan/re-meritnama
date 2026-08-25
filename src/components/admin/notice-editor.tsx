"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNotice, saveNotice } from "@/lib/announce/actions";
import type { Notice } from "@/lib/announce/data";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, FieldHint, Select, TextField } from "@/components/app/field";
import { SaveIcon } from "@/components/ui/save";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

const KINDS = [
  { id: "info", label: "Information" },
  { id: "success", label: "Something is now working" },
  { id: "warning", label: "Attention needed" },
  { id: "danger", label: "Something is wrong" },
];

/**
 * Writing a banner.
 *
 * One form that both creates and edits, because the fields are identical and
 * two forms would be two places to keep them in step.
 *
 * The link field takes an **internal path only**. That is checked here so the
 * author is told why, and by a check constraint on the column so it holds
 * whatever this form does — an external link in a banner shown above every page
 * to every candidate is a phishing vector the moment a staff account is
 * compromised, and these are people being asked for verification details
 * elsewhere in the same week.
 */
export function NoticeEditor({ notice }: { notice?: Notice }) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [open, setOpen] = useState(!notice);
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [emoji, setEmoji] = useState(notice?.icon ?? "");
  const [kind, setKind] = useState<string>(notice?.kind ?? "info");
  const [link, setLink] = useState(notice?.link ?? "");
  const [linkText, setLinkText] = useState(notice?.linkText ?? "");
  const [dismissable, setDismissable] = useState(notice?.dismissable ?? true);
  const [active, setActive] = useState(notice?.active ?? true);
  const [endsAt, setEndsAt] = useState(notice?.endsAt?.slice(0, 16) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveNotice({
        id: notice?.id,
        title,
        body,
        icon: emoji,
        kind,
        link,
        linkText,
        dismissable,
        active,
        endsAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!notice) {
        setTitle("");
        setBody("");
        setEmoji("");
        setLink("");
        setLinkText("");
        setEndsAt("");
        setOpen(false);
      }
      router.refresh();
    });
  }

  function remove() {
    if (!notice) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteNotice(notice.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
      >
        Edit
      </button>
    );
  }

  return (
    <Bezel className={notice ? "mt-3" : "mt-6"} innerClassName="p-5">
      <form onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={`nt-icon-${notice?.id ?? "new"}`}>Icon</FieldLabel>
            <TextField
              id={`nt-icon-${notice?.id ?? "new"}`}
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={8}
              placeholder="⚡"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-3">
            <FieldLabel htmlFor={`nt-title-${notice?.id ?? "new"}`}>Title</FieldLabel>
            <TextField
              id={`nt-title-${notice?.id ?? "new"}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Round 9 consent opens Monday"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-4">
            <FieldLabel htmlFor={`nt-body-${notice?.id ?? "new"}`}>Body</FieldLabel>
            <textarea
              id={`nt-body-${notice?.id ?? "new"}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
              placeholder="One or two sentences. This sits above every page."
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor={`nt-kind-${notice?.id ?? "new"}`}>Tone</FieldLabel>
            <Select
              id={`nt-kind-${notice?.id ?? "new"}`}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor={`nt-ends-${notice?.id ?? "new"}`}>
              Stop showing after
            </FieldLabel>
            <input
              id={`nt-ends-${notice?.id ?? "new"}`}
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="min-h-[46px] w-full rounded-sm border border-border-strong bg-surface-sunken px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
            <FieldHint>
              Optional. A banner about a deadline should stop itself.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor={`nt-link-${notice?.id ?? "new"}`}>Link</FieldLabel>
            <TextField
              id={`nt-link-${notice?.id ?? "new"}`}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/app/portal/merit-list"
            />
            <FieldHint>
              Internal paths only, starting with a slash. External links are
              refused — a banner everyone sees is not a place to send people off
              the site.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor={`nt-linktext-${notice?.id ?? "new"}`}>
              Link text
            </FieldLabel>
            <TextField
              id={`nt-linktext-${notice?.id ?? "new"}`}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              maxLength={40}
              placeholder="Open the merit list"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-5 border-t border-border pt-4">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded-sm border-border-strong accent-[var(--accent-strong)]"
            />
            <span className="text-sm text-foreground">Showing now</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={dismissable}
              onChange={(e) => setDismissable(e.target.checked)}
              className="h-4 w-4 rounded-sm border-border-strong accent-[var(--accent-strong)]"
            />
            <span className="text-sm text-foreground">
              People can dismiss it
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs font-bold text-status-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="submit"
            disabled={pending || !title.trim() || !body.trim()}
            {...handlers}
            className="group flex min-h-[42px] items-center gap-3 rounded-sm bg-accent-strong py-1.5 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Saving…" : notice ? "Save changes" : "Publish banner"}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
              <SaveIcon ref={icon} size={ICON_SIZE_SM} aria-hidden />
            </span>
          </button>

          {notice && (
            <>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="ml-auto font-mono text-[11px] font-bold uppercase tracking-wider text-status-danger transition-opacity hover:opacity-80 disabled:opacity-60"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </form>
    </Bezel>
  );
}
