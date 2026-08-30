"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteArticle, saveArticle } from "@/lib/announce/actions";
import type { Article } from "@/lib/announce/data";
import { estimateReadMinutes } from "@/lib/announce/render";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, FieldHint, Select, TextField } from "@/components/app/field";
import { SaveIcon } from "@/components/ui/save";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * Writing an Editorial piece.
 *
 * **Save and publish are separate.** A draft is visible to staff and to nobody
 * else — the select policy says so — which is what makes it possible to write
 * something over several sittings and read it on the real page before anybody
 * else can. The original has no such state: its pieces are markup in the
 * repository, so writing one and publishing one are the same act.
 *
 * The read-time estimate fills itself from the body but stays editable, because
 * a words-per-minute figure is a guess and the author knows better.
 */
export function ArticleEditor({ article }: { article?: Article }) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [category, setCategory] = useState<string>(article?.category ?? "analysis");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [authorName, setAuthorName] = useState(article?.authorName ?? "MeritNama");
  const [readMinutes, setReadMinutes] = useState<string>(
    article?.readMinutes ? String(article.readMinutes) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const estimate = body.trim() ? estimateReadMinutes(body) : null;

  function save(publish: boolean) {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await saveArticle({
        id: article?.id,
        slug,
        title,
        summary,
        body,
        category,
        readMinutes: readMinutes ? Number(readMinutes) : estimate,
        authorName,
        publish,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(publish ? "Published." : "Saved as a draft.");
      if (!article && result.slug) {
        router.push(`/app/admin/editorial?edit=${result.id}`);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!article) return;
    startTransition(async () => {
      const result = await deleteArticle(article.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/app/admin/editorial");
    });
  }

  return (
    <Bezel className="mt-8" innerClassName="p-6">
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="ed-title">Title</FieldLabel>
            <TextField
              id="ed-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Can Punjab select fairly without another exam?"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="ed-summary">Summary</FieldLabel>
            <textarea
              id="ed-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
              placeholder="Two sentences. This is what appears on the index and in a link preview."
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="ed-category">Category</FieldLabel>
            <Select
              id="ed-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="analysis">Analysis</option>
              <option value="opinion">Opinion</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="ed-author">Byline</FieldLabel>
            <TextField
              id="ed-author"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={80}
            />
            <FieldHint>The site signs its own pieces by default.</FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="ed-slug">Web address</FieldLabel>
            <TextField
              id="ed-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              maxLength={120}
              placeholder="made-from-the-title"
            />
            <FieldHint>
              Leave blank and one is made from the title. Changing it later
              breaks any link already shared.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="ed-read">Read time</FieldLabel>
            <TextField
              id="ed-read"
              type="number"
              value={readMinutes}
              onChange={(e) => setReadMinutes(e.target.value)}
              placeholder={estimate ? String(estimate) : "auto"}
            />
            <FieldHint>
              {estimate
                ? `Estimated ${estimate} min from the body. Override if it is wrong.`
                : "Filled in from the body once there is one."}
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="ed-body">Body</FieldLabel>
            <textarea
              id="ed-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={60000}
              rows={20}
              className="w-full rounded-sm border border-border-strong bg-surface-sunken p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
              placeholder={"Start a line with ## for a heading.\n\nEverything else is a paragraph. Leave a blank line between them."}
            />
            <FieldHint>
              {body.length.toLocaleString("en-GB")} of 60,000. Headings are a
              line starting <span className="text-foreground">##</span>;
              everything else is a paragraph. No HTML and no Markdown — anything
              else is shown exactly as typed, which is deliberate: this page is
              read by every candidate and speaks in the site’s voice.
            </FieldHint>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs font-bold text-status-danger">
            {error}
          </p>
        )}
        {saved && (
          <p aria-live="polite" className="mt-4 text-xs font-bold text-status-safe">
            {saved}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={() => save(true)}
            disabled={pending || !title.trim() || !summary.trim() || !body.trim()}
            {...handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Saving…" : article?.isPublished ? "Save changes" : "Publish"}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <SaveIcon ref={icon} size={ICON_SIZE_SM} aria-hidden />
            </span>
          </button>

          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending || !title.trim() || !summary.trim() || !body.trim()}
            className="rounded-sm border border-border-strong px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-60"
          >
            {article?.isPublished ? "Unpublish" : "Save draft"}
          </button>

          {article && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="ml-auto font-mono text-[11px] font-bold uppercase tracking-wider text-status-danger transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </Bezel>
  );
}
