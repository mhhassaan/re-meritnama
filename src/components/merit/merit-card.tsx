"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MeritRow, MeritScale } from "@/lib/merit/types";
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
  inductions,
  scale,
}: {
  row: MeritRow;
  inductions: number[];
  scale: MeritScale;
}) {
  const [open, setOpen] = useState(false);

  const latest = latestValue(row, scale);
  const average = averageValue(row);
  const seats = latestSeats(row);

  // Only cycles this combination actually ran in — rendering thirteen rows of
  // em dashes to show two data points wastes the screen.
  const ran = inductions.filter(
    (i) => valueFor(row, i, scale) != null
  );

  return (
    <li className="rounded-md border border-border bg-surface">
      <div className="p-4">
        <SpecialtyLabel specialty={row.specialty} className="text-sm" />

        <p className="mt-1 text-sm leading-snug text-fg-muted">{row.hospital}</p>

        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
          {row.program} · {row.quota}
        </p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle">
              Latest close · Ind {row.latest_induction}
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
        className="flex min-h-[48px] w-full items-center justify-between border-t border-border px-4 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors active:text-foreground"
      >
        <span>
          {open ? "Hide" : "Show"} {ran.length} cycle{ran.length === 1 ? "" : "s"}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          {/* The chart answers "which way is this going"; the list below it
              answers "what exactly did it close at". Both are wanted, and the
              chart cannot be read to two decimal places. */}
          <MeritTrendChart
            row={row}
            inductions={inductions}
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
                  <span className="text-fg-subtle">Induction {induction}</span>
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
    </li>
  );
}
