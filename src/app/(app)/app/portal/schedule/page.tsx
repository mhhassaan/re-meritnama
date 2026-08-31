import type { Metadata } from "next";
import { loadSchedule, type SchedulePhase } from "@/lib/portal/schedule";
import { formatDateTime } from "@/lib/format/date";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Schedule | Induction Portal | MeritNama",
  description:
    "Every step of the induction cycle and when its window opens and closes.",
};

/**
 * The induction schedule.
 *
 * The portal's own step list — registration, profile, preferences, verification,
 * gazette, merit lists, consent, joining — with what is open now.
 *
 * Times are rendered through `formatDateTime`, which pins locale and time zone.
 * A bare `toLocaleString()` gives the server and the client different text and
 * fails hydration; and every date here is a deadline, so it must read the same
 * for everyone rather than shifting with the viewer's clock.
 *
 * The boundaries arrive as Pakistan wall-clock rebuilt onto UTC (see
 * `@/lib/portal/schedule`), so formatting in UTC prints the original digits and
 * the label says PKT. Converting to the viewer's zone would be worse, not
 * better: a Pakistani deadline shown in London time invites missing it.
 */

const PHASE: Record<
  SchedulePhase,
  { label: string; tone: "safe" | "reach" | "danger" | "plain"; note: string }
> = {
  active: { label: "Open now", tone: "safe", note: "accepting submissions" },
  upcoming: { label: "Upcoming", tone: "reach", note: "opens later" },
  closed: { label: "Closed", tone: "plain", note: "window has passed" },
  pending: { label: "Not scheduled", tone: "plain", note: "no date published" },
};

const ORDER: SchedulePhase[] = ["active", "upcoming", "pending", "closed"];

export default async function PortalSchedulePage() {
  const steps = await loadSchedule();

  // Grouped by phase rather than listed flat: someone opening this page wants
  // "what is open" first, and the source order buries it among finished steps.
  const grouped = ORDER.map((phase) => ({
    phase,
    steps: steps.filter((step) => step.phase === phase),
  })).filter((group) => group.steps.length > 0);

  const open = steps.filter((s) => s.phase === "active").length;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            The cycle,
            <span className="block text-accent">step by step</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Every stage of the induction and when its window opens. Times
            are Pakistan Standard Time.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
        >
          <Meta label="Steps" value={String(steps.length)} />
          <Meta
            label="Open now"
            value={String(open)}
            tone={open ? "text-status-safe" : "text-fg-subtle"}
          />
          <Meta
            label="Upcoming"
            value={String(steps.filter((s) => s.phase === "upcoming").length)}
            tone="text-status-reach"
          />
          <Meta
            label="Not scheduled"
            value={String(steps.filter((s) => s.phase === "pending").length)}
          />
        </Bezel>

        {grouped.map(({ phase, steps: group }) => (
          <section key={phase} className="mt-12">
            <div className="flex items-baseline gap-3">
              <Pill tone={PHASE[phase].tone}>{PHASE[phase].label}</Pill>
              <span className="font-mono text-[10px] text-fg-subtle">
                {PHASE[phase].note}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-px bg-border">
              {group.map((step) => (
                <div key={step.id} className="bg-background flex flex-wrap items-baseline gap-x-4 gap-y-2 p-4">
                  <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
                    {step.order}
                  </span>

                  <span className="min-w-[14rem] flex-1 font-sans text-sm font-bold text-foreground">
                    {step.title}
                    {step.detail && (
                      <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider text-fg-subtle">
                        {step.detail}
                      </span>
                    )}
                  </span>

                  {/* A step with no published window says so, rather than
                      printing the placeholder timestamp the portal wrote when
                      the row was created. */}
                  {step.start && step.end ? (
                    <span className="font-mono text-[11px] tabular-nums text-fg-muted">
                      {formatDateTime(step.start).replace(" UTC", "")}
                      <span className="mx-1.5 text-fg-subtle">→</span>
                      {formatDateTime(step.end).replace(" UTC", "")}
                      <span className="ml-1.5 text-fg-subtle">PKT</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-fg-subtle">
                      Date not published
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">Check the official portal.</span>{" "}
            PHF moves these dates, sometimes at short notice, and this is a copy
            of the schedule as it stood when the data was captured. Never let a
            deadline here be the only thing you rely on.
          </span>
        </p>
      </div>
    </div>
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
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
