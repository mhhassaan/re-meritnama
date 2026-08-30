"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createThread } from "@/lib/community/actions";
import { LIMITS, THREAD_CATEGORIES, YEAR_STAGES } from "@/lib/community/terms";
import { CategoryIcon } from "@/components/community/category-icon";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, FieldHint, Select, TextField } from "@/components/app/field";
import { MagicWand01Icon } from "@/components/ui/magic-wand-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The new-thread form.
 *
 * Collapsed until asked for, because the page's job is reading threads and a
 * permanently open composer pushes every one of them below the fold.
 *
 * There is no name field, which is the whole difference from the original's
 * version of this form. Its first input is a free-text name defaulting to
 * "Dr. Anonymous"; here the name comes from your profile and the database
 * refuses anything else.
 */
export function ThreadComposer({
  specialties,
  hospitals,
}: {
  specialties: string[];
  hospitals: string[];
}) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospital, setHospital] = useState("");
  const [yearStage, setYearStage] = useState("any");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createThread({
        category,
        title,
        body,
        specialty,
        hospital,
        yearStage,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Straight to the thread rather than back to the list: the next thing a
      // person wants after asking is to see the question they asked.
      router.push(`/app/discussion/${result.id}`);
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
        Start a thread
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
            <FieldLabel htmlFor="th-category">Category</FieldLabel>
            <Select
              id="th-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {THREAD_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            {/* The mark for the chosen category, beside its hint. A native
                `<option>` cannot carry an icon, so this is where the mapping
                becomes learnable — the same drawing appears on the chip and on
                every card in that category. */}
            <FieldHint>
              <span className="inline-flex items-center gap-1.5">
                <CategoryIcon category={category} />
                {THREAD_CATEGORIES.find((c) => c.id === category)?.hint}
              </span>
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="th-stage">Where you are</FieldLabel>
            <Select
              id="th-stage"
              value={yearStage}
              onChange={(e) => setYearStage(e.target.value)}
            >
              {YEAR_STAGES.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </Select>
            <FieldHint>Lets a reader weigh an answer by who gave it.</FieldHint>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="th-title">Title</FieldLabel>
            <TextField
              id="th-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.threadTitle}
              placeholder="A clear title — what are you actually asking?"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="th-body">Detail</FieldLabel>
            <textarea
              id="th-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={LIMITS.threadBody}
              rows={7}
              className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
              placeholder="The more context you give, the better the answers."
            />
            <FieldHint>
              {body.length.toLocaleString("en-GB")} of{" "}
              {LIMITS.threadBody.toLocaleString("en-GB")}. Do not post anyone
              else’s CNIC, phone number or address — yours or theirs.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="th-specialty">Specialty (optional)</FieldLabel>
            <Select
              id="th-specialty"
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
            <FieldLabel htmlFor="th-hospital">Hospital (optional)</FieldLabel>
            <Select
              id="th-hospital"
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
            {pending ? "Posting…" : "Post thread"}
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

          <p className="w-full text-xs leading-relaxed text-fg-subtle sm:w-auto sm:flex-1">
            Posted under your profile display name. There is no anonymous
            posting here.
          </p>
        </div>
      </form>
    </Bezel>
  );
}
