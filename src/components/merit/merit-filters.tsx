"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { MeritScale } from "@/lib/merit/types";
import type { Cycle } from "@/lib/merit/data";
import type { CycleRange, MeritQuery } from "@/lib/merit/query";
import { Select } from "@/components/app/field";

export type Facets = {
  programs: string[];
  quotas: string[];
  specialties: string[];
  hospitals: string[];
};

/**
 * Filter controls.
 *
 * Desktop: a persistent bar. Mobile: a bottom sheet behind a trigger showing
 * the active filter count — so the user always knows the list is narrowed, even
 * when the controls are out of sight. A hidden filter with no indicator is how
 * people conclude data is missing.
 */
export function MeritFilters({
  facets,
  cycles,
  query,
  resultCount,
  totalCount,
  onChange,
}: {
  facets: Facets;
  cycles: Cycle[];
  query: MeritQuery;
  resultCount: number;
  totalCount: number;
  onChange: (next: Partial<MeritQuery>) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount = [query.program, query.quota, query.specialty, query.hospital]
    .filter(Boolean).length;

  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [sheetOpen]);

  const fields = (
    <>
      <CycleRangeSelect
        cycles={cycles}
        value={query.cycleRange ?? 5}
        onChange={(cycleRange) => onChange({ cycleRange })}
      />
      <Facet
        label="Programme"
        value={query.program ?? ""}
        options={facets.programs}
        onChange={(v) => onChange({ program: v || undefined })}
      />
      <Facet
        label="Quota"
        value={query.quota ?? ""}
        options={facets.quotas}
        onChange={(v) => onChange({ quota: v || undefined })}
      />
      <Facet
        label="Specialty"
        value={query.specialty ?? ""}
        options={facets.specialties}
        onChange={(v) => onChange({ specialty: v || undefined })}
      />
      <Facet
        label="Hospital"
        value={query.hospital ?? ""}
        options={facets.hospitals}
        onChange={(v) => onChange({ hospital: v || undefined })}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search gets its own row below `sm`: sharing one row with the scale
          toggle and the filter trigger squeezed it to about six characters. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={query.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
          placeholder="Search specialty or hospital…"
          aria-label="Search specialty or hospital"
          // Recessed rather than raised: an input is a well you type into.
          className="min-h-[46px] w-full min-w-0 rounded-sm border border-border-strong bg-surface-sunken px-4 text-sm text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring sm:flex-1"
        />

        <div className="flex items-center gap-2">
          <ScaleToggle
            scale={query.scale ?? "normalised"}
            onChange={(scale) => onChange({ scale })}
          />

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-sm font-bold text-fg-muted shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent hover:text-foreground active:scale-[0.98] sm:flex-none md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-fg-on-accent">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Desktop: always visible. */}
      <div className="hidden gap-2 md:grid md:grid-cols-5">{fields}</div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {resultCount.toLocaleString("en-GB")}
          </span>{" "}
          of {totalCount.toLocaleString("en-GB")} records
        </p>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                program: undefined,
                quota: undefined,
                specialty: undefined,
                hospital: undefined,
              })
            }
            className="font-mono text-[11px] font-bold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            // The scrim is fixed, so the blur is a one-off composite rather
            // than a repaint on every scrolled frame.
            className="absolute inset-0 h-full w-full cursor-default bg-brand-midnight/50 backdrop-blur-sm motion-safe:animate-[fadeIn_250ms_cubic-bezier(0.32,0.72,0,1)]"
          />
          {/* Anchored to the bottom: reachable one-handed, unlike a modal
              centred in the middle of a tall phone screen. Rises on a weighted
              curve so it reads as having mass. */}
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg border-t border-border bg-surface p-5 pb-9 shadow-lifted motion-safe:animate-[sheetUp_400ms_cubic-bezier(0.32,0.72,0,1)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-base font-bold text-foreground">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                // Icon-only dismiss controls are circular throughout; the
                // squared geometry rule is about labelled action buttons.
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong text-fg-muted transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.94]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-col gap-3">{fields}</div>

            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-sm bg-accent-strong px-4 font-bold text-fg-on-accent shadow-ambient transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Show {resultCount.toLocaleString("en-GB")} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Which cycles get their own column.
 *
 * Options are built from the data rather than hardcoded, so when Induction 22
 * lands the ranges and their year spans move with it. Labelled by year span
 * exactly as the live site does — "2024–2026 (Last 5)".
 */
function CycleRangeSelect({
  cycles,
  value,
  onChange,
}: {
  cycles: Cycle[];
  value: CycleRange;
  onChange: (value: CycleRange) => void;
}) {
  const span = (count: number) => {
    const window = cycles.slice(-count);
    const from = window[0]?.label;
    const to = window[window.length - 1]?.label;
    return from === to ? to : `${from}–${to}`;
  };

  const options: Array<{ value: CycleRange; label: string }> = [
    { value: "all", label: `All cycles (${span(cycles.length)})` },
    ...([1, 3, 5, 10] as const)
      .filter((n) => n < cycles.length)
      .map((n) => ({
        value: n as CycleRange,
        label: `${span(n)} (Last ${n})`,
      })),
  ];

  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
        Cycles shown
      </span>
      <Select
        value={String(value)}
        onChange={(e) =>
          onChange(
            e.target.value === "all"
              ? "all"
              : (Number(e.target.value) as CycleRange)
          )
        }
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Facet({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </label>
  );
}

/**
 * Normalised is the default and stays first.
 *
 * Raw marks from different cycles are on different scales — the total moved
 * from 95 to 30 between inductions 8 and 21 — so comparing them directly is
 * meaningless. Raw remains available because a candidate checking one specific
 * cycle against an official list needs the number as published.
 */
function ScaleToggle({
  scale,
  onChange,
}: {
  scale: MeritScale;
  onChange: (scale: MeritScale) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Merit scale"
      className="flex min-h-[46px] items-center rounded-lg border border-border-strong bg-surface-sunken p-1"
    >
      {(
        [
          ["normalised", "% of max", "Comparable across years"],
          ["raw", "Raw", "As published that year — not comparable across years"],
        ] as const
      ).map(([value, label, hint]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={scale === value}
          title={hint}
          onClick={() => onChange(value)}
          className={`h-full rounded-md px-3.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
            scale === value
              ? "bg-surface text-accent shadow-ambient"
              : "text-fg-subtle hover:text-fg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
