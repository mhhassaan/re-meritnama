import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadThread, loadPostingRights } from "@/lib/community/data";
import { CATEGORY_LABEL, YEAR_STAGE_LABEL } from "@/lib/community/terms";
import {
  AuthorLine,
  Chip,
  HiddenNotice,
  PostingGate,
} from "@/components/community/community-bits";
import { CategoryIcon } from "@/components/community/category-icon";
import { ReportButton } from "@/components/community/report-button";
import { ReplyComposer, WithdrawButton } from "@/components/community/reply-composer";
import { VerseStrip } from "@/components/app/verse-strip";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { ArrowLeft02Icon } from "@/components/ui/arrow-left-02";
import { ICON_SIZE_SM } from "@/components/app/action-icon";

export const metadata: Metadata = {
  title: "Thread | Discussion | MeritNama",
};

/**
 * One thread and its replies.
 *
 * A hidden thread still renders for its author and for staff — the policy
 * returns it to them — so this page shows the notice rather than a 404. Being
 * told your post was removed is the difference between moderation and
 * disappearance.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const threadId = Number(id);
  if (!Number.isFinite(threadId)) notFound();

  const [data, rights] = await Promise.all([
    loadThread(threadId),
    loadPostingRights(),
  ]);

  // Null covers both "no such thread" and "hidden from this reader". Telling
  // them apart would confirm that a removed thread exists, which is not a
  // reader's business.
  if (!data) notFound();

  const { thread, replies } = data;
  const visibleReplies = replies.filter((r) => !r.moderation.hidden || r.author.isMe);

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Link
          href="/app/discussion"
          className="group inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft02Icon size={ICON_SIZE_SM} aria-hidden />
          All threads
        </Link>

        <Eyebrow className="mt-8">Discussion</Eyebrow>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip tone="accent">
            <CategoryIcon category={thread.category} />
            {CATEGORY_LABEL[thread.category] ?? thread.category}
          </Chip>
          {thread.specialty && <Chip>{thread.specialty}</Chip>}
          {thread.hospital && <Chip>{thread.hospital}</Chip>}
          {thread.yearStage && thread.yearStage !== "any" && (
            <Chip>{YEAR_STAGE_LABEL[thread.yearStage] ?? thread.yearStage}</Chip>
          )}
        </div>

        <h1 className="mt-4 break-words font-sans text-2xl font-black leading-tight tracking-[-0.02em] text-foreground sm:text-3xl">
          {thread.title}
        </h1>

        <Bezel className="mt-6" innerClassName="p-6">
          {/* `whitespace-pre-wrap`, not a markdown renderer. Rendering
              user-written markup is a way to smuggle links and formatting into
              a page other people trust; paragraph breaks are all this needs. */}
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground break-words">
            {thread.body}
          </p>

          <HiddenNotice moderation={thread.moderation} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <AuthorLine
              author={thread.author}
              at={thread.createdAt}
              editedAt={thread.editedAt}
            />
            <div className="flex items-center gap-4">
              {thread.author.isMe && !thread.moderation.hidden && (
                <WithdrawButton target="thread" targetId={thread.id} />
              )}
              {!thread.author.isMe && (
                <ReportButton target="thread" targetId={thread.id} />
              )}
            </div>
          </div>
        </Bezel>

        <h2 className="mt-12 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
          {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
        </h2>

        {visibleReplies.length === 0 ? (
          <Bezel className="mt-3" innerClassName="px-6 py-12 text-center">
            <p className="text-sm text-fg-muted">
              No replies yet. If you know the answer, it is worth two minutes.
            </p>
          </Bezel>
        ) : (
          <div className="mt-3 flex flex-col gap-px bg-border">
            {visibleReplies.map((reply) => (
              <div key={reply.id} className="bg-background p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground break-words">
                  {reply.body}
                </p>

                <HiddenNotice moderation={reply.moderation} />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <AuthorLine
                    author={reply.author}
                    at={reply.createdAt}
                    editedAt={reply.editedAt}
                  />
                  <div className="flex items-center gap-4">
                    {reply.author.isMe && !reply.moderation.hidden && (
                      <WithdrawButton target="reply" targetId={reply.id} />
                    )}
                    {!reply.author.isMe && (
                      <ReportButton target="reply" targetId={reply.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {thread.moderation.hidden ? (
          <p className="mt-6 text-xs leading-relaxed text-fg-subtle">
            This thread is not accepting replies while it is hidden.
          </p>
        ) : (
          <>
            <PostingGate rights={rights} />
            {rights.canPost && <ReplyComposer threadId={thread.id} />}
          </>
        )}
      </div>
    </div>
  );
}
