"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { MeritRow, MeritScale } from "@/lib/merit/types";
import type { Cycle } from "@/lib/merit/data";
import type { SortDirection, SortKey } from "@/lib/merit/query";
import {
  averageValue,
  formatValue,
  latestSeats,
  valueFor,
} from "@/lib/merit/query";
import { ConfidenceBadge, SpecialtyLabel, TrendBadge } from "./merit-badges";
import { MeritRowTrend } from "./merit-row-trend";

/**
 * Desktop presentation. Hidden below `md`, where MeritCard takes over.
 *
 * Deliberately NOT rendered on mobile at all rather than made to scroll
 * sideways: a horizontally scrolling data table hides columns behind a gesture
 * nobody discovers, and the hidden columns here are the ones carrying meaning.
 */
export function MeritTable({
  rows,
  cycles,
  scale,
  sort,
  direction,
  onSort,
  selected,
  onSelect,
}: {
  rows: MeritRow[];
  /** The cycles that get their own column — the cycle-range selection. */
  cycles: Cycle[];
  scale: MeritScale;
  sort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  selected: MeritRow | null;
  onSelect: (row: MeritRow | null) => void;
}) {
  const columnInductions = cycles.map((cycle) => cycle.induction);
  // The row whose per-cycle cells are currently swapped for a chart. Hover
  // driven, so there is nothing to close and never more than one.
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    // `overflow-hidden` on the shell clips the table's square corners to the
    // inner radius; without it the header row pokes out of the curve.
    <div className="rounded-lg bg-surface-sunken/70 p-1 shadow-ambient ring-1 ring-border">
      <div className="overflow-x-auto overflow-y-hidden rounded-[0.25rem] bg-surface shadow-[inset_0_1px_0_var(--edge-highlight)]">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Closing merit by specialty, hospital, programme and quota by year,
          shown as {scale === "raw" ? "raw marks" : "a percentage of each cycle's total marks"}.
        </caption>

        {/* Sticky so the cycle a column refers to stays visible while scrolling
            a long result set — otherwise the numbers lose their meaning. */}
        <thead className="sticky top-0 z-10 bg-surface-sunken">
          <tr className="border-b border-border">
            <SortableHeader label="Specialty" sortKey="specialty" {...{ sort, direction, onSort }} className="min-w-[190px] text-left" />
            <SortableHeader label="Hospital" sortKey="hospital" {...{ sort, direction, onSort }} className="min-w-[200px] text-left" />
            <th scope="col" className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              Prog
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              Quota
            </th>

            {/* Years sit directly after quota, as the original does — they are
                the substance of the row. The cycle-range selector keeps the
                count to five by default, which is what makes this order fit.

                Two cycles ran in several of these years, so a year can appear
                more than once; the columns stay in cycle order, so the left one
                is the earlier. The full policy label, which does name the
                induction, is on the `title` for anyone who needs to tell them
                apart. */}
            {cycles.map((cycle, i) => (
              <th
                key={cycle.induction}
                scope="col"
                className={`px-2 py-2.5 text-right font-mono text-[11px] font-bold text-fg-muted ${
                  i === 0 ? "border-l border-border" : ""
                }`}
                // Explicit width so the columns hold their place when a hovered
                // row merges them into one chart cell. Without it the auto
                // layout would re-measure and every row would shift.
                style={{ width: 64 }}
                title={cycle.policyLabel ?? cycle.label}
              >
                {cycle.label}
              </th>
            ))}

            {/* History and Latest are gone from the table: the year columns
                already carry the series, and the rightmost of them is the
                latest. Both remain in the detail panel and the mobile card,
                where there is no year grid to read them off. */}
            {/* "Avg %" not "Avg": the average is always % of max even in raw
                mode, and an unlabelled "Avg" beside raw marks reads as raw. */}
            <SortableHeader label="Avg %" sortKey="average" {...{ sort, direction, onSort }} className="whitespace-nowrap border-l border-border text-right" />
            <SortableHeader label="Seats" sortKey="seats" {...{ sort, direction, onSort }} className="text-right" />
            <SortableHeader label="Trend" sortKey="trend" {...{ sort, direction, onSort }} className="text-left" />
            <th scope="col" className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              Conf
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            const key = `${row.program}|${row.quota}|${row.specialty}|${row.hospital}`;
            const isSelected =
              selected != null &&
              selected.program === row.program &&
              selected.quota === row.quota &&
              selected.specialty === row.specialty &&
              selected.hospital === row.hospital;

            const showChart = hoveredRow === key;

            return (
            <tr
              key={key}
              // Hover previews the shape; clicking opens the full detail panel,
              // which is where percentile, seats and the policy note live.
              onClick={() => onSelect(isSelected ? null : row)}
              onMouseEnter={() => setHoveredRow(key)}
              onMouseLeave={() =>
                setHoveredRow((current) => (current === key ? null : current))
              }
              // Focus counts as hover: a keyboard user tabbing the table gets
              // the same chart a mouse user gets.
              onFocus={() => setHoveredRow(key)}
              aria-selected={isSelected}
              className={`cursor-pointer border-b border-border/60 transition-colors ${
                isSelected
                  ? "bg-accent-quiet"
                  : showChart
                    ? "bg-surface-sunken/60"
                    : i % 2 === 1
                      ? "bg-surface-sunken/25"
                      : ""
              }`}
            >
              <td className="max-w-[220px] px-3 py-2.5">
                <SpecialtyLabel specialty={row.specialty} className="text-[13px]" />
              </td>
              <td className="max-w-[240px] truncate px-3 py-2.5 text-[13px] text-fg-muted" title={row.hospital}>
                {row.hospital}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-fg-muted">{row.program}</td>
              <td className="max-w-[140px] truncate px-3 py-2.5 font-mono text-xs text-fg-muted" title={row.quota}>
                {row.quota}
              </td>

              {/* The per-cycle numbers give way to the same numbers as a
                  shape, in the columns they came from. Merging them into one
                  cell is what lets the chart use the full run of cycles rather
                  than being squeezed into a corner of the row. */}
              {showChart ? (
                <td
                  colSpan={columnInductions.length}
                  className="border-l border-border px-2 py-1.5"
                >
                  {/* The visible cycles, not the whole series: this chart
                      occupies exactly the cells it replaced, so one point per
                      replaced cell keeps the labels legible and the x positions
                      honest. The full history is the sparkline and the panel. */}
                  <MeritRowTrend row={row} cycles={cycles} />
                </td>
              ) : (
                columnInductions.map((induction, i) => {
                  const value = valueFor(row, induction, scale);
                  return (
                    <td
                      key={induction}
                      className={`px-2 py-2.5 text-right font-mono text-xs tabular-nums ${
                        value == null ? "text-fg-subtle" : "text-foreground"
                      } ${i === 0 ? "border-l border-border" : ""}`}
                    >
                      {formatValue(value, scale)}
                    </td>
                  );
                })
              )}

              <td className="border-l border-border px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-muted">
                {/* Always normalised, even in raw mode — see averageValue. */}
                {formatValue(averageValue(row), "normalised")}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-muted">
                {latestSeats(row) ?? "—"}
              </td>
              <td className="px-3 py-2.5">
                <TrendBadge trend={row.trend} />
              </td>
              <td className="px-3 py-2.5">
                <ConfidenceBadge confidence={row.confidence} dataPoints={row.data_points} />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort === sortKey;
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      // aria-sort tells a screen reader the current order without them having to
      // infer it from an icon.
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "text-accent" : "text-fg-muted"
        }`}
      >
        {label}
        {active && <Icon className="h-3 w-3" aria-hidden />}
      </button>
    </th>
  );
}
