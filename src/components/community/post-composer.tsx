"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/lib/community/actions";
import { LIMITS, POST_KINDS } from "@/lib/community/terms";
import { KindIcon } from "@/components/community/category-icon";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, FieldHint, Select, TextField } from "@/components/app/field";
import { MagicWand01Icon } from "@/components/ui/magic-wand-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The Feed composer.
 *
 * The rating only exists on a hospital review, matching a `check` constraint on
 * the column: a rating attached to a question is a number with nothing to rate.
 * The field appears and disappears with the kind rather than sitting there
 * greyed out, so the form never offers a control that would be refused.
 */
export function PostComposer({
  specialties,
  hospitals,
}: {
  specialties: string[];
  hospitals: string[];
}) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospital, setHospital] = useState("");
  const [rating, setRating] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isReview = kind === "hospital_review";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPost({
        kind,
        title,
        body,
        specialty,
        hospital,
        rating: isReview ? rating : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setBody("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        {...handlers}
        className="group mt-6 flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
      >
        New post
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
          <MagicWand01Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <Bezel className="mt-6" innerClassName="p-6">
      <form onSubmit={submit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="fp-kind">Kind</FieldLabel>
            <Select id="fp-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {POST_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
            {/* The mark for the chosen kind, beside its hint — a native
                `<option>` cannot carry one, and this is where the mapping to
                the chips and cards becomes learnable. */}
            <FieldHint>
              <span className="inline-flex items-center gap-1.5">
                <KindIcon kind={kind} />
                {POST_KINDS.find((k) => k.id === kind)?.hint}
              </span>
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="fp-specialty">Specialty (optional)</FieldLabel>
            <Select
              id="fp-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              <option value="">Not specific</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="fp-hospital">
              Hospital {isReview ? "(required)" : "(optional)"}
            </FieldLabel>
            <Select
              id="fp-hospital"
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
            >
              <option value="">Not specific</option>
              {hospitals.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>

          {isReview && (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="fp-rating">Rating</FieldLabel>
              <Select
                id="fp-rating"
                value={String(rating)}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </Select>
              <FieldHint>Your own experience of training there.</FieldHint>
            </div>
          )}

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="fp-title">Title</FieldLabel>
            <TextField
              id="fp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.postTitle}
              placeholder="One line — what is this about?"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="fp-body">Detail</FieldLabel>
            <textarea
              id="fp-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={LIMITS.postBody}
              rows={6}
              className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
              placeholder="What happened, or what you want to know."
            />
            <FieldHint>
              {body.length} / {LIMITS.postBody.toLocaleString("en-GB")}. Never
              post anyone&rsquo;s CNIC, phone number or address.
            </FieldHint>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs font-bold text-status-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button
            type="submit"
            disabled={pending || !title.trim() || !body.trim()}
            {...handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Posting…" : "Post"}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <MagicWand01Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    </Bezel>
  );
}
