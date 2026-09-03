"use client";

import { Bezel } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { useSimulation } from "@/components/portal/simulation-provider";
import { AlertIcon } from "@/components/icons/koboyo";
import { RefreshIcon } from "@/components/ui/refresh";
import { PlayIcon } from "@/components/ui/play";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";
import type { Change, SeatRef } from "@/lib/portal/simulate";

/**
 * The simulation controls and the change log.
 *
 * Sits above the grid, as the live portal's does. It is the only place the
 * result appears: the grid keeps showing the PUBLISHED round, because the point
 * is to compare against it. Replacing the grid with simulated occupancy would
 * lose the reference the reader is measuring from, and make it easy to mistake
 * a prediction for a published fact.
 */
export function SimulationBar() {
  const { editCount, reset, run, running, result, dismiss } = useSimulation();
  const resetIcon = useActionIcon();
  const runIcon = useActionIcon();

  return (
    <>
      <Bezel className="mt-3" innerClassName="flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-fg-muted">
          Click any consent pill to model a decision — Accepted, then Excluded,
          then Awaited — and run the cascade to see what moves.{" "}
          {editCount > 0 ? (
            <span className="font-bold text-accent">
              {editCount} {editCount === 1 ? "edit" : "edits"} pending.
            </span>
          ) : (
            <span className="text-fg-subtle">
              With no edits, this shows what the published consents alone would
              produce.
            </span>
          )}
        </p>

        {editCount > 0 && (
          <button
            type="button"
            onClick={reset}
            {...resetIcon.handlers}
            className="flex min-h-[42px] items-center gap-2 rounded-sm border border-border-strong px-4 text-sm font-bold text-foreground transition-colors hover:border-accent"
          >
            <RefreshIcon ref={resetIcon.ref} size={ICON_SIZE_SM} />
            Restore published
          </button>
        )}

        <button
          type="button"
          onClick={run}
          disabled={running}
          {...runIcon.handlers}
          className="group flex min-h-[42px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Running cascade…" : "Simulate next round"}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
            <PlayIcon ref={runIcon.ref} size={ICON_SIZE_SM} />
          </span>
        </button>
      </Bezel>

      {result && !result.ok && (
        <Bezel className="mt-3" innerClassName="flex items-start gap-3 p-4">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-danger" />
          <p className="text-xs leading-relaxed text-fg-muted">{result.error}</p>
        </Bezel>
      )}

      {result?.ok && (
        <Bezel className="mt-3" innerClassName="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Simulated round {result.round + 1}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 overflow-clip sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="New placements" value={result.placed.length} tone="text-status-safe" />
            <Stat label="Upgrades" value={result.upgraded.length} tone="text-status-reach" />
            <Stat label="Removals" value={result.removed.length} tone="text-status-danger" />
            <Stat label="Vacancies opened" value={result.stats.vacanciesOpened} />
            <Stat label="Waves" value={result.stats.waves} />
            <Stat label="Seats unfilled" value={result.stats.seatsUnfilled} />
          </div>

          {/* If the reader added themselves, their own outcome is the answer
              they came for — it goes above the aggregate change log, not buried
              inside a list of hundreds. */}
          {result.manual && (
            <div className="mt-4 rounded-sm border border-hope/40 bg-hope/10 p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-hope">
                Your manual entry
              </p>
              {result.manual.placed && result.manual.seat ? (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13px] text-foreground">
                  <span className="font-bold">Placed</span>
                  <span>at</span>
                  <span className="font-bold">{result.manual.seat.specialty}</span>
                  <span className="text-fg-muted">@ {result.manual.seat.hospital}</span>
                  <span className="font-mono text-[10px] text-fg-subtle">
                    ({result.manual.seat.program}, {result.manual.seat.quota})
                  </span>
                  {result.manual.preferenceNo != null && (
                    <span className="font-mono text-[10px] text-fg-subtle">
                      preference {result.manual.preferenceNo}
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-fg-muted">
                  Not placed in this run. The cascade only fills seats that
                  become <strong className="text-foreground">vacant</strong> —
                  it moves people between rounds rather than reallocating,
                  so a new entrant takes a seat only when one opens.
                </p>
              )}

              {result.manual.standings.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-hope/30 pt-3">
                  {result.manual.standings.map((standing) => (
                    <li
                      key={`${standing.preferenceNo}-${standing.seat.hospital}`}
                      className="flex flex-wrap items-baseline gap-x-2 text-[13px]"
                    >
                      <span className="font-mono text-[10px] text-fg-subtle">
                        P{standing.preferenceNo}
                      </span>
                      <span className="font-bold text-foreground">
                        {standing.seat.specialty}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg-muted">
                        @ {standing.seat.hospital}
                      </span>
                      <span
                        className={`font-mono text-xs font-bold tabular-nums ${
                          // Inside the seat count is the line that matters:
                          // ranking 2nd for two seats is a very different
                          // message from ranking 2nd for one.
                          standing.rank <= standing.capacity
                            ? "text-status-safe"
                            : "text-status-reach"
                        }`}
                      >
                        #{standing.rank}
                      </span>
                      <span className="font-mono text-[10px] text-fg-subtle">
                        of {standing.competitors.toLocaleString("en-GB")} · {standing.capacity}{" "}
                        {standing.capacity === 1 ? "seat" : "seats"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 font-mono text-[10px] text-fg-subtle">
                Unverified, and no certificate bonus is applied. An
                illustration of where your aggregate falls, not a
                prediction.
              </p>
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
            The grid below still shows the <strong className="text-foreground">published</strong>{" "}
            round {result.round}. This is what would move against it.
          </p>

          <Group
            title="New placements"
            hint="Not placed before; take a seat now"
            tone="safe"
            changes={result.placed}
          />
          <Group
            title="Upgrades"
            hint="Move to a seat they ranked higher"
            tone="reach"
            changes={result.upgraded}
          />
          <Group
            title="Removals"
            hint="Lose their seat and take nothing else"
            tone="danger"
            changes={result.removed}
          />
        </Bezel>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone}`}>
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

const HEAD = 20;

function Group({
  title,
  hint,
  tone,
  changes,
}: {
  title: string;
  hint: string;
  tone: "safe" | "reach" | "danger";
  changes: Change[];
}) {
  if (!changes.length) return null;

  return (
    <details className="mt-4 border-t border-border pt-4">
      <summary className="flex cursor-pointer items-baseline gap-2">
        <Pill tone={tone}>{title}</Pill>
        <span className="font-mono text-[11px] font-bold tabular-nums text-foreground">
          {changes.length.toLocaleString("en-GB")}
        </span>
        <span className="font-mono text-[10px] text-fg-subtle">{hint}</span>
      </summary>

      <ol className="mt-3 flex flex-col gap-2.5">
        {changes.slice(0, HEAD).map((change) => (
          <li key={change.applicantId} className="text-[13px] leading-snug">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
                {change.applicantId}
              </span>
              {change.name ? (
                <span className="font-bold text-foreground">{change.name}</span>
              ) : (
                <span
                  className="font-mono text-xs text-fg-muted"
                  title="Not named in any published merit list"
                >
                  unnamed
                </span>
              )}
              <span className="font-mono text-xs font-bold tabular-nums text-accent">
                {change.mark.toFixed(2)}
              </span>
              <span className="font-mono text-[10px] text-fg-subtle">
                P{change.preferenceNo}
              </span>
            </div>

            <p className="mt-0.5 font-mono text-[10px] leading-snug text-fg-subtle">
              {change.from && <Seat seat={change.from} />}
              {change.from && change.to && <span aria-hidden> → </span>}
              {change.to && <Seat seat={change.to} />}
            </p>
          </li>
        ))}
      </ol>

      {changes.length > HEAD && (
        <p className="mt-3 font-mono text-[10px] text-fg-subtle">
          Showing the first {HEAD} of {changes.length.toLocaleString("en-GB")}, by
          mark.
        </p>
      )}
    </details>
  );
}

function Seat({ seat }: { seat: SeatRef }) {
  return (
    <span>
      {seat.specialty} @ {seat.hospital} ({seat.program}, {seat.quota})
    </span>
  );
}
