import type { Metadata } from "next";
import { loadJobs } from "@/lib/jobs/data";
import { JobsBrowser } from "@/components/jobs/jobs-browser";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { formatDate } from "@/lib/format/date";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Job Openings | MeritNama",
  description:
    "Medical job postings, with open and closed worked out from the deadline rather than a flag frozen at scrape time.",
};

/**
 * Job Openings.
 *
 * The original's framing: "Browse current medical job openings. Filter by role,
 * organization, location, or status."
 *
 * The rest of its sentence — "deadlines and availability update live" — is the
 * one thing not carried over, because it is not true of its own page. See
 * `@/lib/jobs/data`.
 */
export default async function JobsPage() {
  const view = await loadJobs();
  const { stats } = view;

  const scrapedOn = view.generatedAt?.slice(0, 10) ?? null;
  const staleDays = scrapedOn
    ? Math.round(
        (Date.parse(`${view.asOf}T00:00:00Z`) -
          Date.parse(`${scrapedOn}T00:00:00Z`)) /
          86_400_000
      )
    : null;

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Resources</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Medical jobs,{" "}
            <span className="text-accent">honestly dated</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            {stats.total.toLocaleString("en-GB")} postings from{" "}
            {stats.organizations} organizations across {stats.cities} cities,
            covering {stats.roles.toLocaleString("en-GB")} distinct roles.
            Whether a posting is open is worked out from its deadline against
            today, every time this page loads.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-4"
        >
          <Meta label="Postings" value={stats.total.toLocaleString("en-GB")} />
          <Meta
            label="Still open"
            value={stats.open.toLocaleString("en-GB")}
            tone={stats.open ? "text-status-safe" : "text-fg-subtle"}
          />
          <Meta
            label="Closed"
            value={stats.closed.toLocaleString("en-GB")}
            tone={stats.closed ? "text-status-reach" : "text-fg-subtle"}
          />
          <Meta
            label="Typical window"
            value={
              stats.medianWindowDays != null
                ? `${stats.medianWindowDays} days`
                : "—"
            }
            hint="median"
          />
        </Bezel>

        {/* ── How old this is ──────────────────────────────────────────────
            Stated before anything else a reader could act on. A board whose
            postings have all closed is only misleading if it does not say so;
            said plainly, the same rows are a usable record of who hires, for
            what, and how long they leave an advertisement open. */}
        <Bezel className="mt-3" innerClassName="flex items-start gap-3 p-5">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                This is a snapshot
                {scrapedOn ? ` from ${formatDate(scrapedOn)}` : ""}, not a live
                feed.
              </span>{" "}
              {staleDays != null && staleDays > 0 && (
                <>It was scraped {staleDays} days ago, and </>
              )}
              {stats.open === 0 ? (
                <>
                  every deadline in it has now passed. Check the original
                  posting before acting on any row.
                </>
              ) : (
                <>
                  {stats.open} of {stats.total} postings still have time on them.
                  Check the original posting before acting on any row.
                </>
              )}
            </p>

            <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
              Every status and countdown here is worked out from the
              deadline against today, not from the flag the scraper wrote.
            </p>
          </div>
        </Bezel>

        <JobsBrowser jobs={view.jobs} facets={view.facets} />

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">
              Postings are scraped from jobz.pk, not collected from employers.
            </span>{" "}
            Titles, deadlines and vacancy lists are theirs, and every deadline in
            this source carries the qualifier “or as per paper ad” —
            the newspaper advertisement is the authority, not this table. Follow
            the link on any posting before applying.
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
