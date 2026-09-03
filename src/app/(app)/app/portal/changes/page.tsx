import type { Metadata } from "next";
import Link from "next/link";
import { loadDataChanges } from "@/lib/portal/data-changes";
import { DataChangesBrowser } from "@/components/portal/data-changes-browser";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Data Changes | Induction Portal | MeritNama",
  description:
    "What the portal altered between two snapshots of the applicant file, and which of it is a mark actually changing.",
};

/**
 * Candidate Data Changes.
 *
 * The original's framing, kept: it compares the previous snapshot of the
 * applicant file with the current one and shows what changed, by how much, and
 * for which candidates.
 *
 * One thing is not kept, and it is the reason the page exists in this form. See
 * `@/lib/portal/data-changes` — the original reads 0 in the applicant file as a
 * score of nought rather than as no record, so it reports 358 records being
 * filled in as 358 candidates gaining marks.
 */
export default async function DataChangesPage() {
  const view = await loadDataChanges();

  if (!view.ok || !view.summary) {
    return (
      <div>
        <PortalQuoteStrip />
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <Eyebrow>Induction Portal</Eyebrow>
          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
            Data Changes
          </h1>
          <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
            <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                Verify your identity first.
              </span>{" "}
              The snapshot comparison is only readable once your account is
              verified.{" "}
              <Link href="/app" className="font-bold text-accent underline">
                Start here
              </Link>
              .
            </p>
          </Bezel>
        </div>
      </div>
    );
  }

  const { summary } = view;
  const marksTouched =
    summary.marks.appeared + summary.marks.vanished + summary.marks.revised;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            What the portal{" "}
            <span className="text-accent">quietly changed</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            The applicant file is edited between snapshots, and every edit moves
            somebody’s position. This compares the two —{" "}
            <span className="font-mono font-bold text-foreground">
              {summary.totalUpdates.toLocaleString("en-GB")}
            </span>{" "}
            records touched, taken {summary.generatedAt}.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-5"
        >
          <Meta
            label="Previous pool"
            value={summary.oldCount.toLocaleString("en-GB")}
          />
          <Meta
            label="Current pool"
            value={summary.newCount.toLocaleString("en-GB")}
          />
          <Meta
            label="Records changed"
            value={summary.changed.toLocaleString("en-GB")}
            hint={`${((summary.changed / Math.max(1, summary.oldCount)) * 100).toFixed(1)}%`}
          />
          <Meta
            label="New applicants"
            value={summary.added.toLocaleString("en-GB")}
            tone={summary.added ? "text-status-safe" : "text-fg-subtle"}
          />
          <Meta
            label="Removed"
            value={summary.removed.toLocaleString("en-GB")}
            tone={summary.removed ? "text-status-danger" : "text-fg-subtle"}
          />
        </Bezel>

        {/* ── The correction ────────────────────────────────────────────────
            The single most important thing on this page, and the reason it is
            not a straight port. Placed above the browser because a reader who
            scrolls straight into the table will otherwise read 358 records
            being created as 358 people gaining fifteen points. */}
        <Bezel className="mt-8" innerClassName="p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Most of these are not marks changing
          </p>

          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
            A zero in the applicant file means <em>no record</em>, not a score of
            nought. Of the{" "}
            <span className="font-mono font-bold text-foreground">
              {marksTouched}
            </span>{" "}
            candidates whose total merit marks moved, only{" "}
            <span className="font-mono font-bold text-foreground">
              {summary.marks.revised}
            </span>{" "}
            moved between two real marks. The rest are records being filled in or
            blanked as the portal caught up on data entry.
          </p>

          <div className="mt-4 grid overflow-clip sm:grid-cols-3">
            <Meta
              label="Record filled in"
              value={summary.marks.appeared.toLocaleString("en-GB")}
              hint="0 to a mark"
            />
            <Meta
              label="Record blanked"
              value={summary.marks.vanished.toLocaleString("en-GB")}
              hint="a mark to 0"
              tone={summary.marks.vanished ? "text-status-danger" : "text-fg-subtle"}
            />
            <Meta
              label="Marks revised"
              value={summary.marks.revised.toLocaleString("en-GB")}
              hint="both real"
              tone="text-status-reach"
            />
          </div>

          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-fg-subtle">
            The official page labels all {marksTouched} the same way, in the
            second person — “Your total went up by 17.1343 points”.
            Filter to <em>Revised between two real marks</em> to see the ones
            where that sentence is true.
          </p>
        </Bezel>

        <DataChangesBrowser candidates={view.candidates} />

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">
              CNIC values, name strings and individual preference seats are not
              shown.
            </span>{" "}
            The source diff records all three. CNIC is a national identity
            number and the official page does not render it either. A
            “previous name” column is free text already shown to
            contain identity numbers, so only the fact that a name record was
            filled in is kept — the names printed here come from the candidate
            roster, where a father’s name is stripped at ingest. Preference
            changes are counted rather than listed, because the seats themselves
            are already on the{" "}
            <Link href="/app/portal/pool" className="font-bold text-accent underline">
              Candidate Pool
            </Link>
            , per candidate, and do not need a second copy.
          </span>
        </p>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  hint,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>
        {value}
        {hint && (
          <span className="ml-1.5 text-[10px] font-normal text-fg-subtle">
            {hint}
          </span>
        )}
      </p>
    </div>
  );
}
