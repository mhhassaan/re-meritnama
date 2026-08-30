import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isStaffReader, loadArticle } from "@/lib/announce/data";
import { parseArticle } from "@/lib/announce/render";
import { VerseStrip } from "@/components/app/verse-strip";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Chip } from "@/components/community/community-bits";
import { formatDate } from "@/lib/format/date";
import { ArrowLeft02Icon } from "@/components/ui/arrow-left-02";
import { ICON_SIZE_SM } from "@/components/app/action-icon";
import { AlertIcon } from "@/components/icons/koboyo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);

  return {
    title: article ? `${article.title} | Editorial | MeritNama` : "Editorial | MeritNama",
    description: article?.summary,
  };
}

/**
 * One piece.
 *
 * Its own URL, unlike the original's hash-routed single page — an article
 * somebody sends you should open on the article, and its title should be in the
 * browser tab.
 *
 * The body is parsed, never injected. See `@/lib/announce/render` for why the
 * format is headings and paragraphs and nothing else: anything unrecognised
 * renders as the literal text the author typed, which is the safe failure on a
 * surface that speaks in the site's voice.
 */
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [article, staff] = await Promise.all([loadArticle(slug), isStaffReader()]);

  // Null covers both "no such piece" and "a draft, and you are not staff". The
  // policy already made that decision; telling them apart would confirm a draft
  // exists.
  if (!article) notFound();

  const blocks = parseArticle(article.body);

  return (
    <div>
      <VerseStrip />

      <article className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Link
          href="/app/editorial"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft02Icon size={ICON_SIZE_SM} aria-hidden />
          All pieces
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Eyebrow>{article.category}</Eyebrow>
          {!article.isPublished && <Chip tone="reach">draft</Chip>}
        </div>

        <h1 className="mt-5 break-words font-sans text-[2rem] font-black leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[2.75rem]">
          {article.title}
        </h1>

        <p className="mt-5 break-words text-[17px] leading-relaxed text-fg-muted">
          {article.summary}
        </p>

        <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-border py-4 font-mono text-[11px] text-fg-subtle">
          <span
            aria-hidden
            className="mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent-quiet text-[10px] font-black uppercase text-accent"
          >
            {article.authorName.charAt(0)}
          </span>
          <span className="font-bold text-fg-muted">{article.authorName}</span>
          {article.publishedAt && <span>· {formatDate(article.publishedAt)}</span>}
          {article.readMinutes && <span>· {article.readMinutes} min read</span>}
          {staff && (
            <Link
              href={`/app/admin/editorial?edit=${article.id}`}
              className="ml-auto text-accent underline"
            >
              Edit
            </Link>
          )}
        </p>

        {!article.isPublished && (
          <Bezel className="mt-6" innerClassName="flex items-start gap-3 p-4">
            <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
            <p className="text-xs leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">Draft.</span> Only
              staff can see this. Publish it from the editor when it is ready.
            </p>
          </Bezel>
        )}

        {/* `prose`-style spacing by hand rather than a plugin: there are two
            block types, and a typography plugin would style markup this page
            never renders. */}
        <div className="mt-10 flex flex-col gap-6">
          {blocks.map((block, i) =>
            block.kind === "heading" ? (
              <h2
                key={i}
                className="mt-4 break-words font-sans text-xl font-black leading-snug tracking-[-0.02em] text-foreground"
              >
                {block.text}
              </h2>
            ) : (
              <p
                key={i}
                className="whitespace-pre-wrap break-words text-[16px] leading-[1.75] text-fg-muted"
              >
                {block.text}
              </p>
            )
          )}
        </div>

        <p className="mt-16 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          This is argument and interpretation, not gazette. Numbers quoted here
          come from the same published merit lists the rest of the site reads;
          the reading of them is the author’s. Verify against official PHF
          and PGMI sources before acting on anything.
        </p>
      </article>
    </div>
  );
}
