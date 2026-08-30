import type { Metadata } from "next";
import Link from "next/link";
import { isStaffReader, loadAllNotices } from "@/lib/announce/data";
import { NoticeEditor } from "@/components/admin/notice-editor";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Chip } from "@/components/community/community-bits";
import { formatDateTime } from "@/lib/format/date";
import { AlertIcon, ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Announcements | MeritNama",
};

/**
 * Writing the banner that sits above every page.
 *
 * Staff only — `notifications_write` is `is_staff()`, so a moderator or an
 * administrator can publish without a developer in the loop. That was the point
 * of moving these out of a file in the repo: during a live round the owner
 * needs to be able to tell every candidate something on the day, and a
 * redeploy is not a communication channel.
 */
export default async function NotificationsAdminPage() {
  const staff = await isStaffReader();

  if (!staff) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Eyebrow>Staff</Eyebrow>
        <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
          Announcements
        </h1>
        <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <p className="text-sm leading-relaxed text-fg-muted">
            <span className="font-bold text-status-reach">Staff only.</span>{" "}
            Moderators and administrators can publish announcements.{" "}
            <Link href="/app" className="font-bold text-accent underline">
              Back to the app
            </Link>
            .
          </p>
        </Bezel>
      </div>
    );
  }

  const notices = await loadAllNotices();
  const live = notices.filter((n) => !n.hiddenFromReaders);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <Reveal>
        <Eyebrow>Staff</Eyebrow>

        <h1 className="mt-6 max-w-[18ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-5xl">
          Tell everyone
          <span className="block text-accent">something</span>
        </h1>

        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          A banner above every page in the app, for every verified candidate.{" "}
          <span className="font-mono font-bold text-foreground">{live.length}</span>{" "}
          showing now, {notices.length} in total. Keep them short and let them
          expire — a banner nobody can dismiss and nothing switches off becomes
          furniture.
        </p>
      </Reveal>

      <NoticeEditor />

      <h2 className="mt-12 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
        Published
      </h2>

      {notices.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-16 text-center">
          <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            Nothing announced
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Nothing carried over from the original site. Its two live banners
            point at pages that do not exist here, so starting empty was better
            than importing something already wrong.
          </p>
        </Bezel>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {notices.map((notice) => (
            <Bezel key={notice.id} innerClassName="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={notice.hiddenFromReaders ? "plain" : "accent"}>
                  {notice.hiddenFromReaders ? "not showing" : "live"}
                </Chip>
                <Chip>{notice.kind}</Chip>
                {!notice.dismissable && <Chip tone="reach">cannot dismiss</Chip>}
                {notice.endsAt && (
                  <Chip>ends {formatDateTime(notice.endsAt)}</Chip>
                )}
              </div>

              <p className="mt-3 break-words font-sans text-sm font-bold text-foreground">
                {notice.icon} {notice.title}
              </p>
              <p className="mt-1.5 break-words text-sm leading-relaxed text-fg-muted">
                {notice.body}
              </p>

              {notice.link && (
                <p className="mt-2 break-words font-mono text-[10px] text-fg-subtle">
                  → {notice.link}
                  {notice.linkText ? ` (${notice.linkText})` : ""}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="font-mono text-[10px] text-fg-subtle">
                  {formatDateTime(notice.createdAt)}
                </p>
                <NoticeEditor notice={notice} />
              </div>
            </Bezel>
          ))}
        </div>
      )}

      <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
        <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
        <span>
          <span className="font-bold text-status-reach">
            Links must stay inside the site.
          </span>{" "}
          A banner above every page is the most trusted surface here, and the
          people reading it are being asked for verification details elsewhere in
          the same week. An external link would be refused by the database as
          well as by the form. Dismissals are remembered in each person’s
          own browser, so a new announcement reaches everybody.
        </span>
      </p>
    </div>
  );
}
