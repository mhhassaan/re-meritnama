"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { MeritRow, MeritScale } from "@/lib/merit/types";
import type { SortDirection, SortKey } from "@/lib/merit/query";
import {
  averageValue,
  formatValue,
  latestSeats,
  latestValue,
  valueFor,
} from "@/lib/merit/query";
import { ConfidenceBadge, SpecialtyLabel, TrendBadge } from "./merit-badges";
import { Sparkline } from "./sparkline";
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
  inductions,
  scale,
  sort,
  direction,
  onSort,
}: {
  rows: MeritRow[];
  inductions: number[];
  scale: MeritScale;
  sort: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  // The row whose per-cycle cells are currently swapped for a chart. Hover
  // driven, so there is nothing to close and never more than one.
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Closing merit by specialty, hospital, programme and quota across
          induction cycles, shown as {scale === "raw" ? "raw marks" : "a percentage of each cycle's total marks"}.
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

            {/* Summary before per-cycle history. At 1440 px the thirteen cycle
                columns push everything past the right edge, and the columns
                that get hidden are the ones carrying the conclusion. The
                per-cycle breakdown is the deep dive, so it is what scrolls. */}
            <th scope="col" className="px-3 py-2.5 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              History
            </th>
            <SortableHeader label="Latest" sortKey="latest" {...{ sort, direction, onSort }} className="text-right" />
            {/* "Avg %" not "Avg": the average is always % of max even in raw
                mode, and an unlabelled "Avg" beside raw marks reads as raw. */}
            <SortableHeader label="Avg %" sortKey="average" {...{ sort, direction, onSort }} className="whitespace-nowrap text-right" />
            <SortableHeader label="Seats" sortKey="seats" {...{ sort, direction, onSort }} className="text-right" />
            <SortableHeader label="Trend" sortKey="trend" {...{ sort, direction, onSort }} className="text-left" />
            <th scope="col" className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
              Conf
            </th>

            {inductions.map((induction, i) => (
              <th
                key={induction}
                scope="col"
                // A single rule marks where summary ends and history begins.
                className={`px-2 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted ${
                  i === 0 ? "border-l border-border" : ""
                }`}
                // Explicit width so the columns hold their place when a hovered
                // row merges all thirteen into one chart cell. Without it the
                // auto layout would re-measure and every row would shift.
                style={{ width: 56 }}
                title={`Induction ${induction}`}
              >
                {induction}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            const key = `${row.program}|${row.quota}|${row.specialty}|${row.hospital}`;
            const showChart = hoveredRow === key;

            return (
            <tr
              key={key}
              onMouseEnter={() => setHoveredRow(key)}
              onMouseLeave={() =>
                setHoveredRow((current) => (current === key ? null : current))
              }
              // Focus counts as hover: a keyboard user tabbing the table gets
              // the same chart a mouse user gets.
              onFocus={() => setHoveredRow(key)}
              className={`border-b border-border/60 transition-colors ${
                showChart
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

              <td className="px-3 py-2.5 text-center">
                <Sparkline row={row} inductions={inductions} />
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                {formatValue(latestValue(row, scale), scale)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-fg-muted">
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

              {/* The per-cycle numbers give way to the same numbers as a
                  shape, in the columns they came from. Merging them into one
                  cell is what lets the chart use the full run of cycles rather
                  than being squeezed into a corner of the row. */}
              {showChart ? (
                <td
                  colSpan={inductions.length}
                  className="border-l border-border px-2 py-1.5"
                >
                  <MeritRowTrend row={row} inductions={inductions} />
                </td>
              ) : (
                inductions.map((induction, i) => {
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
            </tr>
            );
          })}
        </tbody>
      </table>
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
