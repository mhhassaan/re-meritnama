"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/lib/community/actions";
import { LIMITS } from "@/lib/community/terms";
import { StarsInput } from "@/components/community/stars";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, FieldHint, Select, TextField } from "@/components/app/field";
import { MagicWand01Icon } from "@/components/ui/magic-wand-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * Writing a training review, on the hospital's own profile.
 *
 * The original's fields, in its order: an overall rating, three optional
 * aspects — teaching quality, work-life balance, seniors' support — the year
 * you trained, and an optional specialty. Its prompt is "Share your training
 * experience at this hospital", kept.
 *
 * It writes a `community_posts` row with `kind = 'hospital_review'`, so this
 * form inherits the authorship trigger, the rate limit, reporting and
 * moderation without restating any of them.
 *
 * **The overall rating is required and the aspects are not.** Somebody who
 * wants to say one thing about a place should not have to score four; making
 * the aspects mandatory is how a review form turns into a form nobody fills in.
 */
export function ReviewComposer({
  hospital,
  specialties,
  alreadyReviewed,
}: {
  hospital: string;
  /** The specialties this hospital actually trains. */
  specialties: string[];
  alreadyReviewed: boolean;
}) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [teaching, setTeaching] = useState(0);
  const [balance, setBalance] = useState(0);
  const [seniors, setSeniors] = useState(0);
  const [trainingYear, setTrainingYear] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Back far enough to cover somebody writing about a training post they
  // finished a while ago, without offering a list nobody scrolls.
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 12 }, (_, i) => thisYear - i);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!rating) {
      setError("Give an overall rating first — the rest is optional.");
      return;
    }

    startTransition(async () => {
      const result = await createPost({
        kind: "hospital_review",
        title,
        body,
        hospital,
        specialty,
        rating,
        teaching,
        balance,
        seniors,
        trainingYear: trainingYear ? Number(trainingYear) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          {...handlers}
          className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
        >
          {alreadyReviewed ? "Write another review" : "Share your experience"}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
            <MagicWand01Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
          </span>
        </button>

        {alreadyReviewed && (
          <p className="font-mono text-[10px] text-fg-subtle">
            You have already reviewed this hospital.
          </p>
        )}
      </div>
    );
  }

  return (
    <Bezel className="mt-4" innerClassName="p-6">
      <form onSubmit={submit}>
        <p className="font-sans text-sm font-bold text-foreground">
          Share your training experience at {hospital}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
          Write about training you did, not what you have heard. This carries
          your display name.
        </p>

        <div className="mt-5 flex flex-col gap-3 border-y border-border py-4">
          <StarsInput
            name="rv-overall"
            label="Overall"
            value={rating}
            onChange={setRating}
          />
          <StarsInput
            name="rv-teaching"
            label="Teaching quality"
            value={teaching}
            onChange={setTeaching}
            optional
          />
          <StarsInput
            name="rv-balance"
            label="Work-life balance"
            value={balance}
            onChange={setBalance}
            optional
          />
          <StarsInput
            name="rv-seniors"
            label="Seniors' support"
            value={seniors}
            onChange={setSeniors}
            optional
          />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="rv-year">Year you trained</FieldLabel>
            <Select
              id="rv-year"
              value={trainingYear}
              onChange={(e) => setTrainingYear(e.target.value)}
            >
              <option value="">Not saying</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <FieldHint>
              A place changes. A reader weighs a review by how old it is.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="rv-specialty">Specialty (optional)</FieldLabel>
            <Select
              id="rv-specialty"
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
            <FieldHint>
              Training differs by unit more than by hospital.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="rv-title">Summary</FieldLabel>
            <TextField
              id="rv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.postTitle}
              placeholder="One line — what should someone know?"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="rv-body">Your experience</FieldLabel>
            <textarea
              id="rv-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={LIMITS.postBody}
              rows={6}
              className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
              placeholder="Rota, teaching, how much you actually did, what you wish you had known."
            />
            <FieldHint>
              {body.length} / {LIMITS.postBody.toLocaleString("en-GB")}. Write
              about the training, not about a named person.
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
            {pending ? "Posting…" : "Submit review"}
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
