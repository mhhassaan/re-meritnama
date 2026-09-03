import type { Metadata } from "next";
import Link from "next/link";
import { isStaffReader, loadArticles } from "@/lib/announce/data";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Chip } from "@/components/community/community-bits";
import { formatDate } from "@/lib/format/date";
import { ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Editorial | MeritNama",
  description:
    "Analysis and commentary on Pakistan's residency induction, written by the people who maintain this data.",
};

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "analysis", label: "Analysis" },
  { id: "opinion", label: "Opinion" },
];

/**
 * Editorial.
 *
 * The original's framing, kept: "In-depth analysis, policy commentary, and
 * data-driven insights on Pakistan medical residency admissions." Its two
 * categories, its byline convention, its read-time estimate.
 *
 * Two differences, both structural rather than stylistic:
 *
 * - **The pieces live in a table, not in the page.** The original's are markup
 *   inside `editorial.html`, so publishing one is a code change. Here a
 *   moderator or administrator writes one at `/app/admin/editorial`.
 * - **Each piece has its own URL.** The original hash-routes inside one page
 *   (`editorial.html#punjab-fairer-residency-selection`), so an article cannot
 *   be linked to in a way that opens on it, and nothing about it is in the
 *   title. Ours are `/app/editorial/<slug>`.
 *
 * Drafts are returned to staff by the policy and shown here marked, so this
 * doubles as the place an author checks their own work before publishing.
 */
export default async function EditorialPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;

  const [articles, staff] = await Promise.all([
    loadArticles(params.category),
    isStaffReader(),
  ]);

  const href = (category: string) =>
    category ? `/app/editorial?category=${category}` : "/app/editorial";

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Eyebrow>Editorial</Eyebrow>
            {staff && (
              <Link
                href="/app/admin/editorial"
                className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent underline"
              >
                Write a piece
              </Link>
            )}
          </div>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Longer than{" "}
            <span className="text-accent">a merit table</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Analysis and commentary on how residency selection in Punjab
            actually works, written by the people who maintain this data. Slower
            than a thread and more considered — a table shows what happened, a
            piece here argues about why.
          </p>
        </Reveal>

        <div className="mt-10 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id || "all"}
              scroll={false}
              href={href(c.id)}
              className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                (params.category ?? "") === c.id
                  ? "border-accent bg-accent-quiet font-bold text-accent"
                  : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <Bezel className="mt-6" innerClassName="px-8 py-20 text-center">
            <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              Nothing published yet
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              {staff
                ? "Nothing was carried over from the original — its pieces are the owner's writing, not data. Write the first one."
                : "Check back. Pieces are published here as they are written."}
            </p>
          </Bezel>
        ) : (
          <div className="mt-6 flex flex-col gap-px bg-border">
            {articles.map((article) => (
              <div key={article.id} className="bg-background p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="accent">{article.category}</Chip>
                  {!article.isPublished && <Chip tone="reach">draft</Chip>}
                </div>

                <Link
                  href={`/app/editorial/${article.slug}`}
                  className="mt-3 block break-words font-sans text-lg font-bold leading-snug text-foreground transition-colors hover:text-accent"
                >
                  {article.title}
                </Link>

                <p className="mt-2 break-words text-sm leading-relaxed text-fg-muted">
                  {article.summary}
                </p>

                <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-fg-subtle">
                  {article.authorName}
                  {article.readMinutes ? ` · ${article.readMinutes} min read` : ""}
                  {article.publishedAt ? ` · ${formatDate(article.publishedAt)}` : " · unpublished"}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-16 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          Pieces here are argument and interpretation, not gazette. Where one
          quotes a number, the number comes from the same published merit lists
          the rest of this site reads — but the reading of it is the
          author’s.
        </p>
      </div>
    </div>
  );
}
