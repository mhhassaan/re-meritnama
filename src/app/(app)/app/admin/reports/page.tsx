import type { Metadata } from "next";
import Link from "next/link";
import { loadQueue, type ReportedItem } from "@/lib/community/moderation";
import { REPORT_REASON_LABEL, TARGET_LABEL } from "@/lib/community/terms";
import { ReportActions } from "@/components/community/report-actions";
import { Chip } from "@/components/community/community-bits";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { formatDateTime } from "@/lib/format/date";
import { AlertIcon, ArchiveIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Reports | MeritNama",
};

/**
 * The moderation queue.
 *
 * Staff only, and gated in two places on purpose. `loadQueue` returns an empty
 * view for anyone who is not staff, because `content_reports`' select policy is
 * `own OR staff` and it checks the role before reading — but the real control
 * is the policy itself. Nothing here uses the service role.
 *
 * Reports are grouped by the item reported. Three people objecting to one post
 * is one decision, and a list of rows would let a coordinated group make a
 * single post look like a queue of problems.
 */
export default async function ReportsPage() {
  const view = await loadQueue();

  if (!view.ok) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Eyebrow>Staff</Eyebrow>
        <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
          Reports
        </h1>
        <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <p className="text-sm leading-relaxed text-fg-muted">
            <span className="font-bold text-status-reach">Staff only.</span> This
            queue is readable by moderators and administrators.{" "}
            <Link href="/app" className="font-bold text-accent underline">
              Back to the app
            </Link>
            .
          </p>
        </Bezel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <Reveal>
        <Eyebrow>Staff</Eyebrow>

        <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-5xl">
          What people
          <span className="block text-accent">flagged</span>
        </h1>

        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          Every report is read by a person. Nothing is hidden
          automatically on a count of reports.
        </p>
      </Reveal>

      <Bezel
        className="mt-10"
        innerClassName="grid grid-cols-2 gap-px bg-border"
      >
        <Meta
          label="Open"
          value={view.counts.open.toLocaleString("en-GB")}
          tone={view.counts.open ? "text-status-reach" : "text-status-safe"}
        />
        <Meta label="Resolved" value={view.counts.resolved.toLocaleString("en-GB")} />
      </Bezel>

      <h2 className="mt-12 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
        Needs a decision
      </h2>

      {view.open.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-16 text-center">
          <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            Nothing open
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Every report has been acted on.
          </p>
        </Bezel>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {view.open.map((item) => (
            <Item key={`${item.target}:${item.targetId}`} item={item} />
          ))}
        </div>
      )}

      {view.resolved.length > 0 && (
        <>
          <h2 className="mt-12 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
            Already decided
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {view.resolved.map((item) => (
              <Item key={`${item.target}:${item.targetId}`} item={item} resolved />
            ))}
          </div>
        </>
      )}

      <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
        <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
        <span>
          <span className="font-bold text-status-reach">
            Hiding is not deleting.
          </span>{" "}
          A hidden item stays visible to its author and to staff, and the row
          survives — a decision that destroys its own evidence cannot be
          reviewed, and a reported post that vanished would take the report with
          it. Reporters are never shown to the person they reported.
        </span>
      </p>
    </div>
  );
}

function Item({ item, resolved }: { item: ReportedItem; resolved?: boolean }) {
  const open = item.reports.filter((r) => !r.resolvedAt);

  return (
    <Bezel innerClassName="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent">{TARGET_LABEL[item.target]}</Chip>
        <Chip tone={open.length ? "reach" : "plain"}>
          {item.reports.length}{" "}
          {item.reports.length === 1 ? "report" : "reports"}
        </Chip>
        {item.content?.hidden && (
          <Chip tone="reach">
            {item.content.hiddenReason === "author" ? "withdrawn" : "hidden"}
          </Chip>
        )}
      </div>

      {item.content ? (
        <>
          {item.content.title && (
            <p className="mt-3 break-words font-sans text-sm font-bold text-foreground">
              {item.content.title}
            </p>
          )}
          {/* Clamped: a reviewer needs enough to judge, and the link opens the
              thing in place. An 8,000-character body would bury the controls. */}
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted break-words">
            {item.content.body}
          </p>
          <p className="mt-2 break-words font-mono text-[10px] text-fg-subtle">
            by {item.content.authorName} · {formatDateTime(item.content.createdAt)}
            {item.content.href && (
              <>
                {" · "}
                <Link href={item.content.href} className="text-accent underline">
                  see it in place
                </Link>
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-fg-subtle">
          The content is gone. Only the reports remain.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
        {item.reports.map((report) => (
          <div key={report.id} className="text-xs leading-relaxed">
            <span className="font-mono font-bold text-fg-muted">
              {REPORT_REASON_LABEL[report.reason] ?? report.reason}
            </span>
            <span className="font-mono text-[10px] text-fg-subtle">
              {" · "}
              {formatDateTime(report.createdAt)}
              {report.resolvedAt && ` · closed as ${report.action}`}
            </span>
            {report.note && (
              <p className="mt-0.5 whitespace-pre-wrap text-fg-muted break-words">
                “{report.note}”
              </p>
            )}
          </div>
        ))}
      </div>

      {!resolved && item.content && (
        <div className="mt-4 border-t border-border pt-3">
          <ReportActions
            target={item.target}
            targetId={item.targetId}
            hidden={item.content.hidden}
            hasOpenReports={open.length > 0}
          />
        </div>
      )}
    </Bezel>
  );
}

function Meta({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}
