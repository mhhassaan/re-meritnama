"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { MeritScale } from "@/lib/merit/types";
import type { MeritQuery } from "@/lib/merit/query";

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
  query,
  resultCount,
  totalCount,
  onChange,
}: {
  facets: Facets;
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
      <Select
        label="Programme"
        value={query.program ?? ""}
        options={facets.programs}
        onChange={(v) => onChange({ program: v || undefined })}
      />
      <Select
        label="Quota"
        value={query.quota ?? ""}
        options={facets.quotas}
        onChange={(v) => onChange({ quota: v || undefined })}
      />
      <Select
        label="Specialty"
        value={query.specialty ?? ""}
        options={facets.specialties}
        onChange={(v) => onChange({ specialty: v || undefined })}
      />
      <Select
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
          className="min-h-[44px] w-full min-w-0 sm:flex-1 rounded-sm border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />

        <div className="flex items-center gap-2">
          <ScaleToggle
            scale={query.scale ?? "normalised"}
            onChange={(scale) => onChange({ scale })}
          />

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-sm border border-border-strong px-3 text-sm font-bold text-fg-muted transition-colors hover:text-foreground sm:flex-none md:hidden"
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
      <div className="hidden gap-2 md:grid md:grid-cols-4">{fields}</div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {resultCount.toLocaleString("en-GB")}
          </span>{" "}
          of {totalCount.toLocaleString("en-GB")} seat combinations
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
            className="absolute inset-0 h-full w-full cursor-default bg-brand-midnight/50"
          />
          {/* Anchored to the bottom: reachable one-handed, unlike a modal
              centred in the middle of a tall phone screen. */}
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg border-t border-border bg-surface p-4 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-base font-bold text-foreground">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-fg-muted"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-col gap-3">{fields}</div>

            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-sm bg-accent-strong px-4 font-bold text-white"
            >
              Show {resultCount.toLocaleString("en-GB")} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] rounded-sm border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
      className="flex min-h-[44px] items-center rounded-sm border border-border-strong bg-surface p-0.5"
    >
      {(
        [
          ["normalised", "% of max", "Comparable across cycles"],
          ["raw", "Raw", "As published that cycle — not comparable across cycles"],
        ] as const
      ).map(([value, label, hint]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={scale === value}
          title={hint}
          onClick={() => onChange(value)}
          className={`h-full rounded-sm px-3 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            scale === value
              ? "bg-accent-quiet text-accent"
              : "text-fg-subtle hover:text-fg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
