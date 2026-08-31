import type { Metadata } from "next";
import Link from "next/link";
import { loadFeed, loadPostingRights } from "@/lib/community/data";
import { POST_KINDS, POST_KIND_LABEL } from "@/lib/community/terms";
import { loadSeats } from "@/lib/portal/data";
import { PostComposer } from "@/components/community/post-composer";
import {
  AuthorLine,
  Chip,
  HiddenNotice,
  PostingGate,
} from "@/components/community/community-bits";
import { KindIcon } from "@/components/community/category-icon";
import { ReportButton } from "@/components/community/report-button";
import { WithdrawButton } from "@/components/community/reply-composer";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Community Feed | MeritNama",
  description:
    "Questions, hospital reviews, resources and result updates from verified candidates.",
};

/**
 * Community Feed.
 *
 * The original's four kinds, verbatim, filtered by specialty and hospital.
 *
 * Its own version of this page currently holds **zero posts**, which is worth
 * knowing rather than hiding: the empty state says what the surface is for
 * instead of pretending an absence of content is a loading state.
 *
 * The difference from Discussion is the unit. A thread is a conversation and
 * grows replies; a post here is one structured statement — a review of a
 * hospital, a resource, what a round actually did — and is found by filtering
 * rather than by reading down.
 */
export default async function CommunityFeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    specialty?: string;
    hospital?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const [view, rights, seats] = await Promise.all([
    loadFeed({
      kind: params.kind,
      specialty: params.specialty,
      hospital: params.hospital,
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
    const merged = {
      kind: params.kind,
      specialty: params.specialty,
      hospital: params.hospital,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) search.set(k, v);
    const text = search.toString();
    return `/app/community${text ? `?${text}` : ""}`;
  };

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Community</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            What people
            <span className="block text-accent">are finding out</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Reviews of places people actually trained, resources worth passing
            on, and what a round really did. Filter to your specialty or a
            hospital you are considering. For a conversation rather than a
            statement, use{" "}
            <Link href="/app/discussion" className="font-bold text-accent underline">
              Discussion
            </Link>
            .
          </p>
        </Reveal>

        <PostingGate rights={rights} />
        {rights.canPost && (
          <PostComposer specialties={specialties} hospitals={hospitals} />
        )}

        {/* ── Kinds ───────────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap gap-2">
{/* `scroll={false}`: a filter change should leave the reader where
              they were. Next.js scrolls to the top by default, which is right
              for a different page and wrong for a dropdown beside the row you
              are reading — it is most of what makes a filter feel like a
              reload. Pagination below keeps the default on purpose. */}
          <Link
            scroll={false}
            href={query({ kind: undefined })}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              !params.kind
                ? "border-accent bg-accent-quiet font-bold text-accent"
                : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
            }`}
          >
            All
          </Link>
          {POST_KINDS.map((k) => (
            <Link
              key={k.id}
              scroll={false}
              href={query({ kind: k.id })}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                params.kind === k.id
                  ? "border-accent bg-accent-quiet font-bold text-accent"
                  : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
              }`}
            >
              <KindIcon kind={k.id} className="h-3.5 w-auto shrink-0" />
              {k.label}
              {view.byKind[k.id] ? (
                <span className="ml-1.5 opacity-60">{view.byKind[k.id]}</span>
              ) : null}
            </Link>
          ))}
        </div>

        {/* Facets are only offered once something carries them. An empty
            dropdown is a control that promises a filter it cannot perform. */}
        {(view.facets.specialties.length > 0 || view.facets.hospitals.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {params.specialty && (
              <Link
                scroll={false}
                href={query({ specialty: undefined })}
                className="font-mono text-[10px] uppercase tracking-wider text-accent underline"
              >
                Clear specialty: {params.specialty}
              </Link>
            )}
            {params.hospital && (
              <Link
                scroll={false}
                href={query({ hospital: undefined })}
                className="font-mono text-[10px] uppercase tracking-wider text-accent underline"
              >
                Clear hospital: {params.hospital}
              </Link>
            )}
          </div>
        )}

        <p className="mt-6 font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {view.matched.toLocaleString("en-GB")}
          </span>{" "}
          {view.matched === 1 ? "post" : "posts"}
        </p>

        {view.posts.length === 0 ? (
          <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
            <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              Nothing here yet
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              A review of somewhere you trained is the most useful thing on this
              page, and nobody else can write it.
            </p>
          </Bezel>
        ) : (
          <div className="mt-3 flex flex-col gap-px bg-border">
            {view.posts.map((post) => (
              <div key={post.id} className="bg-background p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="accent">
                    <KindIcon kind={post.kind} />
                    {POST_KIND_LABEL[post.kind] ?? post.kind}
                  </Chip>
                  {post.specialty && (
                    <Link scroll={false} href={query({ specialty: post.specialty })}>
                      <Chip>{post.specialty}</Chip>
                    </Link>
                  )}
                  {post.hospital && (
                    <Link scroll={false} href={query({ hospital: post.hospital })}>
                      <Chip>{post.hospital}</Chip>
                    </Link>
                  )}
                  {post.rating != null && (
                    <Chip tone="reach">{post.rating} / 5</Chip>
                  )}
                </div>

                <p className="mt-3 break-words font-sans text-base font-bold leading-snug text-foreground">
                  {post.title}
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted break-words">
                  {post.body}
                </p>

                <HiddenNotice moderation={post.moderation} />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <AuthorLine
                    author={post.author}
                    at={post.createdAt}
                    editedAt={post.editedAt}
                  />
                  <div className="flex items-center gap-4">
                    {post.author.isMe && !post.moderation.hidden && (
                      <WithdrawButton target="post" targetId={post.id} />
                    )}
                    {!post.author.isMe && (
                      <ReportButton target="post" targetId={post.id} />
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
