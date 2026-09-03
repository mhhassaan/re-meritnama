import type { Metadata } from "next";
import Link from "next/link";

import { loadThreads, loadPostingRights } from "@/lib/community/data";
import { CATEGORY_LABEL, THREAD_CATEGORIES } from "@/lib/community/terms";
import { loadSeats } from "@/lib/portal/data";
import { ThreadComposer } from "@/components/community/thread-composer";
import {
  AuthorLine,
  Chip,
  HiddenNotice,
  PostingGate,
} from "@/components/community/community-bits";
import { CategoryIcon } from "@/components/community/category-icon";
import { ReportButton } from "@/components/community/report-button";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Discussion | MeritNama",
  description:
    "Ask questions and share experience with other verified candidates. Every post carries the name of the person who wrote it.",
};

/**
 * Discussion.
 *
 * The original's framing, kept: "Ask questions, share experiences, and connect
 * with fellow trainees." Its seven categories, verbatim.
 *
 * One thing is not carried over. Its new-thread form opens with a free-text
 * name field defaulting to "Dr. Anonymous", which is why nearly every post on
 * the live forum reads "Anonymous" and one of its seven threads is signed
 * "Admin" — a string anybody could type. Here the name comes from the poster's
 * verified profile and a database trigger, and there is no field in which to
 * ask to be somebody else.
 */
export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;

  const [view, rights, seats] = await Promise.all([
    loadThreads({
      category: params.category,
      search: params.q,
      page: Number(params.page) || 1,
    }),
    loadPostingRights(),
    loadSeats(),
  ]);

  const specialties = [...new Set(seats.map((s) => s.specialty.trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const hospitals = [...new Set(seats.map((s) => s.hospital.trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const query = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { category: params.category, q: params.q, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) search.set(k, v);
    const text = search.toString();
    return `/app/discussion${text ? `?${text}` : ""}`;
  };

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Community</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Ask the people{" "}
            <span className="text-accent">who went first</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Questions, experience and advice from other verified candidates.
            Slower than{" "}
            <Link
              href="/app/portal/chat"
              className="font-bold text-accent underline"
            >
              Chat
            </Link>{" "}
            and worth more later — a thread is still here next cycle.
          </p>
        </Reveal>

        {/* ── How this works ───────────────────────────────────────────────
            Stated once, above the list, rather than buried in a policy page.
            Every line of it is a rule the database actually enforces. */}
        <Bezel className="mt-10" innerClassName="p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            How this works
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-fg-muted">
            <li>
              <span className="font-bold text-foreground">
                Everything you post carries your name.
              </span>{" "}
              Your profile display name, set by the database rather than typed
              into the form. There is no anonymous posting, and nobody can post
              as somebody else.
            </li>
            <li>
              <span className="font-bold text-foreground">
                Never post anyone’s CNIC, phone number or address.
              </span>{" "}
              Not theirs, and not your own. This site exists because a previous
              version of it published exactly that.
            </li>
            <li>
              <span className="font-bold text-foreground">
                Report anything that needs a look.
              </span>{" "}
              A person reads every report; nothing hides itself on a count. The
              writer is never told who reported them.
            </li>
          </ul>
        </Bezel>

        <PostingGate rights={rights} />
        {rights.canPost && (
          <ThreadComposer specialties={specialties} hospitals={hospitals} />
        )}

        {/* ── Categories ──────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap gap-2">
{/* `scroll={false}`: a filter change should leave the reader where
              they were. Next.js scrolls to the top by default, which is right
              for a different page and wrong for a dropdown beside the row you
              are reading — it is most of what makes a filter feel like a
              reload. Pagination below keeps the default on purpose. */}
          <Link
            scroll={false}
            href={query({ category: undefined })}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              !params.category
                ? "border-accent bg-accent-quiet font-bold text-accent"
                : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
            }`}
          >
            All
          </Link>
          {THREAD_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              scroll={false}
              href={query({ category: c.id })}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                params.category === c.id
                  ? "border-accent bg-accent-quiet font-bold text-accent"
                  : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
              }`}
            >
              <CategoryIcon category={c.id} className="h-3.5 w-auto shrink-0" />
              {c.label}
              {view.byCategory[c.id] ? (
                <span className="ml-1.5 opacity-60">{view.byCategory[c.id]}</span>
              ) : null}
            </Link>
          ))}
        </div>

        <p className="mt-6 font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {view.matched.toLocaleString("en-GB")}
          </span>{" "}
          {view.matched === 1 ? "thread" : "threads"}
        </p>

        {view.threads.length === 0 ? (
          <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
            <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              {params.category || params.q
                ? "Nothing here yet"
                : "No threads yet"}
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              {params.category || params.q
                ? "Try another category, or clear the filter."
                : "Be the first. A question asked now is an answer somebody finds next cycle."}
            </p>
          </Bezel>
        ) : (
          <div className="mt-3 flex flex-col gap-px bg-border">
            {view.threads.map((thread) => (
              <div key={thread.id} className="bg-background p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="accent">
                    <CategoryIcon category={thread.category} />
                    {CATEGORY_LABEL[thread.category] ?? thread.category}
                  </Chip>
                  {thread.specialty && <Chip>{thread.specialty}</Chip>}
                  {thread.hospital && <Chip>{thread.hospital}</Chip>}
                </div>

                <Link
                  href={`/app/discussion/${thread.id}`}
                  className="mt-3 block break-words font-sans text-base font-bold leading-snug text-foreground transition-colors hover:text-accent"
                >
                  {thread.title}
                </Link>

                {/* Clamped rather than truncated with an ellipsis in the data:
                    the full body is one click away and the list is for
                    scanning. */}
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-fg-muted break-words">
                  {thread.body}
                </p>

                <HiddenNotice moderation={thread.moderation} />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <AuthorLine
                    author={thread.author}
                    at={thread.createdAt}
                    editedAt={thread.editedAt}
                  />
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-fg-subtle">
                      {thread.replyCount}{" "}
                      {thread.replyCount === 1 ? "reply" : "replies"}
                    </span>
                    {!thread.author.isMe && (
                      <ReportButton target="thread" targetId={thread.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view.pageCount > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="font-mono text-[10px] text-fg-subtle">
              Page {view.page} of {view.pageCount}
            </p>
            <div className="flex gap-3">
              {view.page > 1 && (
                <Link
                  href={query({ page: String(view.page - 1) })}
                  className="rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
                >
                  Newer
                </Link>
              )}
              {view.page < view.pageCount && (
                <Link
                  href={query({ page: String(view.page + 1) })}
                  className="rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
                >
                  Older
                </Link>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
