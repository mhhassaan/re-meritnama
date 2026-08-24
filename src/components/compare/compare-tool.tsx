"use client";

import { useMemo, useState } from "react";
import type { MeritRow } from "@/lib/merit/types";
import {
  buildComparison,
  comboOptions,
  findCombo,
  MAX_COLUMNS,
  MIN_COLUMNS,
  type CompareCell,
  type CompareCycle,
} from "@/lib/compare/compare";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, Select } from "@/components/app/field";
import {
  ConfidenceBadge,
  SpecialtyLabel,
  TrendBadge,
} from "@/components/merit/merit-badges";
import { BalanceIcon } from "@/components/icons/koboyo";
import { GridViewIcon } from "@/components/ui/grid-view";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The comparison tool.
 *
 * Framing is the original's: a programme picker, three combination pickers, a
 * button, and a transposed table of metrics. What changed is the presentation
 * and two numbers — see `normalisedStddev` in `@/lib/compare/compare` for why
 * Std Deviation is not the figure the source file carries.
 *
 * Selection state is local rather than in the URL. Unlike the merit lists,
 * nothing here is fetched per selection — the whole aggregate set is already in
 * the client — so a navigation would re-render the page to change a dropdown.
 */
export function CompareTool({
  rows,
  cycles,
  programs,
}: {
  rows: MeritRow[];
  cycles: CompareCycle[];
  programs: string[];
}) {
  const { ref: icon, handlers } = useActionIcon();

  // FCPS is the original's default and by far the largest programme.
  const [program, setProgram] = useState(
    programs.includes("FCPS") ? "FCPS" : (programs[0] ?? "")
  );
  const [picks, setPicks] = useState<string[]>(["", "", ""]);
  const [submitted, setSubmitted] = useState<string[] | null>(null);

  const options = useMemo(
    () => comboOptions(rows, program),
    [rows, program]
  );

  const chosen = picks.filter(Boolean);
  const canCompare = chosen.length >= MIN_COLUMNS;

  const comparison = useMemo(() => {
    if (!submitted) return null;
    const found = submitted
      .map((label) => findCombo(rows, program, label))
      .filter((r): r is MeritRow => r != null);
    if (found.length < MIN_COLUMNS) return null;
    return buildComparison(found, cycles);
  }, [submitted, rows, program, cycles]);

  function setPick(index: number, value: string) {
    setPicks((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  return (
    <>
      <Bezel className="mt-12" innerClassName="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canCompare) setSubmitted(chosen.slice(0, MAX_COLUMNS));
          }}
          className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
        >
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="cmp-program">Program</FieldLabel>
            <Select
              id="cmp-program"
              value={program}
              onChange={(e) => {
                setProgram(e.target.value);
                // Combinations are scoped to the programme, so a pick carried
                // over would name a seat that does not exist under the new one.
                setPicks(["", "", ""]);
                setSubmitted(null);
              }}
            >
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          {picks.map((pick, i) => (
            <div key={i} className="flex flex-col gap-1">
              <FieldLabel htmlFor={`cmp-pick-${i}`}>
                Combination {i + 1}
                {i === 2 && (
                  <span className="ml-1.5 font-normal text-fg-subtle">
                    optional
                  </span>
                )}
              </FieldLabel>
              <Select
                id={`cmp-pick-${i}`}
                value={pick}
                onChange={(e) => setPick(i, e.target.value)}
              >
                <option value="">Select specialty – hospital</option>
                {options.map((o) => (
                  <option
                    key={o}
                    value={o}
                    // The same combination in two columns compares a seat with
                    // itself, which the original permitted and which reads as a
                    // bug.
                    disabled={picks.some((p, j) => j !== i && p === o)}
                  >
                    {o}
                  </option>
                ))}
              </Select>
            </div>
          ))}

          <button
            type="submit"
            disabled={!canCompare}
            {...handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <GridViewIcon ref={icon} size={ICON_SIZE_SM} />
            </span>
          </button>
        </form>

        {/* The original raises an `alert()` on submit. Stating the requirement
            up front is the same information without the interruption. */}
        {!canCompare && (
          <p className="mt-4 font-mono text-[11px] text-fg-subtle">
            Select at least {MIN_COLUMNS} combinations to compare.
          </p>
        )}
      </Bezel>

      {comparison == null ? (
        <Bezel className="mt-6" innerClassName="px-8 py-20 text-center">
          <BalanceIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            Nothing compared yet
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Choose two or three specialty and hospital combinations above, then
            select Compare.
          </p>
        </Bezel>
      ) : (
        <div className="mt-6 rounded-lg bg-surface-sunken/70 p-1 shadow-ambient ring-1 ring-border">
          <div className="overflow-x-auto rounded-[0.25rem] bg-surface shadow-[inset_0_1px_0_var(--edge-highlight)]">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                {comparison.columns.length} {program} combinations compared
                across {comparison.metrics.length} metrics.
              </caption>

              <thead>
                <tr className="border-b border-border">
                  {/* Sticky, because the metric name is what makes a cell
                      readable and the table scrolls sideways on a phone. */}
                  <th
                    scope="col"
                    // Narrower on a phone: at 13rem the sticky column takes
                    // more than half a 390px screen and the first seat's
                    // figures have nowhere to land.
                    className="sticky left-0 z-10 min-w-[9.5rem] bg-surface-sunken px-3 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted sm:min-w-[13rem] sm:px-4"
                  >
                    Metric
                  </th>

                  {comparison.columns.map((row) => (
                    <th
                      key={`${row.specialty}-${row.hospital}-${row.quota}`}
                      scope="col"
                      className="min-w-[13rem] border-l border-border bg-surface-sunken px-4 py-3 text-left align-top"
                    >
                      <SpecialtyLabel
                        specialty={row.specialty}
                        className="text-[13px]"
                      />
                      <p className="mt-1 text-xs font-normal leading-snug text-fg-muted">
                        {row.hospital}
                      </p>
                      <p className="mt-1 font-mono text-[10px] font-normal uppercase tracking-wider text-fg-subtle">
                        {row.quota}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {comparison.metrics.map((metric, i) => (
                  <tr
                    key={metric.label}
                    className={`border-b border-border/60 ${
                      i % 2 === 1 ? "bg-surface-sunken/25" : ""
                    }`}
                  >
                    <th
                      scope="row"
                      // A sticky cell must be fully opaque or the columns
                      // scroll visibly underneath it. The stripe is `/25`, so
                      // the flattened equivalent is mixed rather than reusing
                      // the translucent class.
                      className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2.5 text-left text-[13px] font-bold text-foreground sm:px-4 ${
                        i % 2 === 1
                          ? "bg-[color-mix(in_oklab,var(--surface-sunken)_25%,var(--surface))]"
                          : "bg-surface"
                      }`}
                      title={metric.hint}
                    >
                      {metric.label}
                      {metric.hint && (
                        <span
                          aria-hidden
                          className="ml-1.5 font-mono text-[10px] font-normal text-fg-subtle"
                        >
                          ⓘ
                        </span>
                      )}
                    </th>

                    {metric.cells.map((cell, j) => (
                      <td
                        key={j}
                        className="border-l border-border px-4 py-2.5 text-[13px]"
                      >
                        <Cell cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * One cell.
 *
 * Absent values render as an em dash, never as 0 — a cycle a seat did not run
 * and a cycle it closed at zero are different facts, and the original's table
 * printed both the same way.
 */
function Cell({ cell }: { cell: CompareCell }) {
  switch (cell.kind) {
    case "text":
      return <span>{cell.value}</span>;

    case "number":
      if (cell.value == null) {
        return <span className="font-mono text-xs text-fg-subtle">—</span>;
      }
      return (
        <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">
          {cell.value.toFixed(cell.digits)}
          {cell.suffix}
        </span>
      );

    case "trend":
      return <TrendBadge trend={cell.row.trend} />;

    case "volatility":
      return <VolatilityBadge volatility={cell.row.volatility} />;

    case "confidence":
      return (
        <ConfidenceBadge
          confidence={cell.row.confidence}
          dataPoints={cell.row.data_points}
        />
      );
  }
}

/**
 * Volatility, on the same fixed-width box as Confidence.
 *
 * High volatility is a warning rather than a failure — a seat can swing widely
 * and still be reachable — so it takes the reach tone, not the danger one.
 */
function VolatilityBadge({
  volatility,
}: {
  volatility: MeritRow["volatility"];
}) {
  const className =
    {
      low: "border-status-safe/50 text-status-safe",
      medium: "border-status-reach/50 text-status-reach",
      high: "border-status-danger/50 text-status-danger",
    }[volatility] ?? "border-border-strong text-fg-subtle";

  return (
    <span
      className={`inline-flex w-[4.75rem] items-center justify-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${className}`}
      title={`${volatility} volatility — how much this seat's closing merit has swung between cycles`}
    >
      {volatility}
    </span>
  );
}
