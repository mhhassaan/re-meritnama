import type { Metadata } from "next";
import Link from "next/link";
import { isStaffReader, loadArticles } from "@/lib/announce/data";
import { ArticleEditor } from "@/components/admin/article-editor";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Chip } from "@/components/community/community-bits";
import { formatDate } from "@/lib/format/date";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Write | Editorial | MeritNama",
};

/**
 * The Editorial desk.
 *
 * Staff only — `editorial_write` is `is_staff()`, so a moderator or an
 * administrator publishes without a developer. Drafts are theirs alone to see
 * until they publish.
 */
export default async function EditorialAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const staff = await isStaffReader();

  if (!staff) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Eyebrow>Staff</Eyebrow>
        <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
          Editorial
        </h1>
        <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <p className="text-sm leading-relaxed text-fg-muted">
            <span className="font-bold text-status-reach">Staff only.</span>{" "}
            Moderators and administrators can write here.{" "}
            <Link href="/app/editorial" className="font-bold text-accent underline">
              Read the published pieces
            </Link>
            .
          </p>
        </Bezel>
      </div>
    );
  }

  const params = await searchParams;
  const articles = await loadArticles();
  const editing = params.edit
    ? articles.find((a) => a.id === Number(params.edit))
    : undefined;

  const drafts = articles.filter((a) => !a.isPublished);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Eyebrow>Staff</Eyebrow>
          <Link
            href="/app/editorial"
            className="font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
          >
            View the index
          </Link>
        </div>

        <h1 className="mt-6 max-w-[18ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-5xl">
          {editing ? "Edit a piece" : "Write a piece"}
        </h1>

        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          {articles.length} written, {drafts.length}{" "}
          {drafts.length === 1 ? "draft" : "drafts"}. A draft is visible to staff
          and to nobody else, so you can read it on the real page before anyone
          else can.
        </p>
      </Reveal>

      {/* Keyed on what is being edited, so switching pieces resets the form
          rather than carrying the previous one's text into it. */}
      <ArticleEditor key={editing?.id ?? "new"} article={editing} />

      {editing && (
        <p className="mt-4">
          <Link
            href="/app/admin/editorial"
            className="font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
          >
            + Start a new piece instead
          </Link>
        </p>
      )}

      <h2 className="mt-12 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
        Everything written
      </h2>

      {articles.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          Nothing yet. Nothing was carried over from the original either — its
          pieces are the owner&rsquo;s writing rather than data, so they are
          theirs to bring across.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {articles.map((article) => (
            <Bezel key={article.id} innerClassName="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="accent">{article.category}</Chip>
                <Chip tone={article.isPublished ? "plain" : "reach"}>
                  {article.isPublished ? "published" : "draft"}
                </Chip>
              </div>

              <p className="mt-3 break-words font-sans text-sm font-bold text-foreground">
                {article.title}
              </p>
              <p className="mt-1.5 break-words text-xs leading-relaxed text-fg-muted">
                {article.summary}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="break-words font-mono text-[10px] text-fg-subtle">
                  /app/editorial/{article.slug}
                  {article.publishedAt ? ` · ${formatDate(article.publishedAt)}` : ""}
                </p>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/app/editorial/${article.slug}`}
                    className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
                  >
                    Read
                  </Link>
                  <Link
                    href={`/app/admin/editorial?edit=${article.id}`}
                    className="font-mono text-[10px] uppercase tracking-wider text-accent"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </Bezel>
          ))}
        </div>
      )}
    </div>
  );
}
