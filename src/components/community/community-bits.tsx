import Link from "next/link";
import type { Author, Moderation, PostingRights } from "@/lib/community/data";
import { Bezel } from "@/components/app/bezel";
import { formatDate } from "@/lib/format/date";
import { AlertIcon } from "@/components/icons/koboyo";

/**
 * Pieces shared by Discussion, the Feed and the moderation queue.
 *
 * Server components: none of them holds state, and keeping them off the client
 * means a thread list of 20 items hydrates nothing.
 */

/**
 * Who wrote it and when.
 *
 * The name is the author's verified profile display name, copied onto the row
 * when they posted. Unlike the original — where the name is a free-text field
 * on the form, which is why nearly every post there reads "Anonymous" and one
 * is signed "Admin" — there is no way to write under somebody else's name.
 */
export function AuthorLine({
  author,
  at,
  editedAt,
}: {
  author: Author;
  at: string;
  editedAt?: string | null;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-fg-subtle">
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-quiet text-[9px] font-black uppercase text-accent"
      >
        {author.name.charAt(0)}
      </span>
      <span className="min-w-0 break-words font-bold text-fg-muted">{author.name}</span>
      {author.isMe && (
        <span className="uppercase tracking-wider text-hope">you</span>
      )}
      <span>· {formatDate(at)}</span>
      {editedAt && <span className="italic">· edited</span>}
    </p>
  );
}

/**
 * What is shown in place of content that has been removed.
 *
 * The row is kept rather than deleted, and the author still sees their own —
 * finding a post silently gone teaches nothing, and a moderation decision that
 * destroys its own evidence cannot be reviewed.
 */
export function HiddenNotice({ moderation }: { moderation: Moderation }) {
  if (!moderation.hidden) return null;

  return (
    <p className="mt-2 flex items-start gap-2 rounded-sm border border-border-strong bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-fg-muted">
      <AlertIcon className="mt-px h-3.5 w-auto shrink-0 text-status-reach" />
      <span>
        {moderation.reason === "author" ? (
          <>You withdrew this. Only you and staff can see it.</>
        ) : (
          <>
            <span className="font-bold text-status-reach">Removed by staff.</span>{" "}
            Only you and staff can see it.
          </>
        )}
      </span>
    </p>
  );
}

/**
 * Why the composer is not available, when it is not.
 *
 * Both cases are recoverable and the message says how. `private.can_post()` is
 * what actually decides; this only explains the same rule before the attempt
 * rather than after a policy violation.
 */
export function PostingGate({ rights }: { rights: PostingRights }) {
  if (rights.canPost) return null;

  return (
    <Bezel className="mt-6" innerClassName="flex items-start gap-3 p-5">
      <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
      <p className="text-sm leading-relaxed text-fg-muted">
        {rights.blockedBy === "no-display-name" ? (
          <>
            <span className="font-bold text-status-reach">
              Add a display name before posting.
            </span>{" "}
            Everything you write here carries it, so that a reply can be weighed
            by who gave it.{" "}
            <Link href="/app/profile" className="font-bold text-accent underline">
              Set one on your profile
            </Link>
            .
          </>
        ) : (
          <>
            <span className="font-bold text-status-reach">
              Verify your account before posting.
            </span>{" "}
            You can read everything here either way.{" "}
            <Link href="/app" className="font-bold text-accent underline">
              Start here
            </Link>
            .
          </>
        )}
      </p>
    </Bezel>
  );
}

/** A small labelled chip, used for categories, kinds and context. */
export function Chip({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "accent" | "reach";
}) {
  const classes =
    tone === "accent"
      ? "border-accent/50 text-accent"
      : tone === "reach"
        ? "border-status-reach/50 text-status-reach"
        : "border-border-strong text-fg-muted";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${classes}`}
    >
      {children}
    </span>
  );
}
