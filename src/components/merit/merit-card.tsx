"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MeritRow, MeritScale } from "@/lib/merit/types";
import type { Cycle } from "@/lib/merit/data";
import {
  averageValue,
  formatValue,
  latestSeats,
  latestValue,
  seatsFor,
  valueFor,
} from "@/lib/merit/query";
import { ConfidenceBadge, SpecialtyLabel, TrendBadge } from "./merit-badges";
import { Sparkline } from "./sparkline";
import { MeritTrendChart } from "./merit-trend-chart";

/**
 * Mobile presentation of one merit row.
 *
 * Not a squeezed table row. A 9-column table on a 390 px screen becomes a
 * horizontal scroll, which is the failure mode to avoid — so the card leads
 * with the two identifying fields, then ONE headline number, then trend and
 * confidence. The per-cycle history is real and useful but not what someone
 * scanning on a phone needs first, so it sits behind a tap.
 */
export function MeritCard({
  row,
  cycles,
  scale,
}: {
  row: MeritRow;
  cycles: Cycle[];
  scale: MeritScale;
}) {
  const [open, setOpen] = useState(false);

  const inductions = cycles.map((cycle) => cycle.induction);
  const labelOf = (induction: number) =>
    cycles.find((cycle) => cycle.induction === induction)?.label ?? "—";

  const latest = latestValue(row, scale);
  const average = averageValue(row);
  const seats = latestSeats(row);

  // Only cycles this combination actually ran in — rendering thirteen rows of
  // em dashes to show two data points wastes the screen.
  const ran = inductions.filter(
    (i) => valueFor(row, i, scale) != null
  );

  return (
    // A row in a hairline list, not a card. Sixty stacked enclosures was the
    // single boxiest thing in the app; the list's 1px gaps separate them and an
    // open row is marked by its fill rather than by a lifted shadow.
    <li className={`bg-background ${open ? "bg-surface" : ""}`}>
      <div className="overflow-hidden">
      <div className="p-4">
        <SpecialtyLabel specialty={row.specialty} className="text-sm" />

        <p className="mt-1 text-sm leading-snug text-fg-muted">{row.hospital}</p>

        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
          {row.program} · {row.quota}
        </p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle">
              Latest close · {labelOf(row.latest_induction)}
            </p>
            <p className="mt-0.5 font-mono text-2xl font-bold text-foreground">
              {formatValue(latest, scale)}
            </p>
          </div>
          <Sparkline row={row} inductions={inductions} width={80} height={26} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <TrendBadge trend={row.trend} />
          <ConfidenceBadge
            confidence={row.confidence}
            dataPoints={row.data_points}
          />
          {/* Always normalised, even in raw mode — see averageValue. */}
          <span className="font-mono text-[11px] text-fg-muted">
            avg {formatValue(average, "normalised")} of max
          </span>
          {seats != null && (
            <span className="font-mono text-[11px] text-fg-muted">
              {seats} seat{seats === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* 48 px tall: comfortably above the 44 px touch minimum. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex min-h-[52px] w-full items-center justify-between border-t border-border py-1.5 pl-4 pr-1.5 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors active:text-foreground"
      >
        <span>
          {open ? "Hide" : "Show"} {ran.length} year{ran.length === 1 ? "" : "s"}
        </span>
        {/* Nested well rather than a naked chevron, and it rotates on a
            weighted curve so the expansion feels driven rather than switched. */}
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-quiet text-accent transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-active:scale-95"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          {/* The chart answers "which way is this going"; the list below it
              answers "what exactly did it close at". Both are wanted, and the
              chart cannot be read to two decimal places. */}
          <MeritTrendChart
            row={row}
            cycles={cycles}
            className="mb-4"
            aspectRatio="2 / 1"
          />

          <ul className="flex flex-col gap-1.5">
            {ran.map((induction) => {
              const value = valueFor(row, induction, scale);
              const cycleSeats = seatsFor(row, induction);
              return (
                <li
                  key={induction}
                  className="flex items-baseline justify-between gap-3 font-mono text-xs"
                >
                  <span className="text-fg-subtle">{labelOf(induction)}</span>
                  <span className="flex-1 border-b border-dotted border-border" />
                  <span className="font-bold text-foreground">
                    {formatValue(value, scale)}
                  </span>
                  <span className="w-14 text-right text-fg-subtle">
                    {cycleSeats != null ? `${cycleSeats} seat${cycleSeats === 1 ? "" : "s"}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      </div>
    </li>
  );
}
