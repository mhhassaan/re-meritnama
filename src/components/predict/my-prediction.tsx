"use client";

import { useMemo, useRef, useState } from "react";
import type { MeritRow } from "@/lib/merit/types";
import type { CalculatorPolicy } from "@/lib/calculator/types";
import {
  countByBucket,
  highConfidenceShare,
  percentileFor,
  predict,
  requirementsFor,
  type Bucket,
  type Prediction,
} from "@/lib/predict/predict";
import { bandFor } from "@/lib/calculator/score";
import { Bezel } from "@/components/app/bezel";
import { HairlineCard, HairlineGrid } from "@/components/app/hairline-grid";
import {
  FieldHint,
  FieldLabel,
  NumberField,
  SearchField,
  Select,
} from "@/components/app/field";
import { PredictionCard } from "./prediction-card";
import { ScoreDistribution } from "./score-distribution";
import { ExportReportButton } from "./export-report-button";
import { ZoomInAreaIcon } from "@/components/ui/zoom-in-area";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";
// Animated on hover, and they no-op under `prefers-reduced-motion` — the
// registry's shared hook handles that, so no guard is needed here.
import { Shield02Icon } from "@/components/ui/shield-02";
import { Target01Icon } from "@/components/ui/target-01";
import { Rocket01Icon } from "@/components/ui/rocket-01";
import { SparklesIcon } from "@/components/ui/sparkles";

/**
 * My Prediction.
 *
 * A redesign of the original, not a reinterpretation of it: the two modes, the
 * inputs, the thresholds, the card fields, the legend and the bucket copy are
 * all the original's, kept verbatim. What changed is the presentation.
 *
 * Everything runs in the browser over data already loaded for the merit table.
 * No score a candidate types is sent anywhere.
 */

type Mode = "score" | "target";

const BUCKETS: Array<{
  id: Bucket;
  label: string;
  description: string;
  Icon: typeof Shield02Icon;
  accent: string;
}> = [
  {
    id: "safe",
    label: "Safe",
    description: "Your score comfortably exceeds historical cutoffs",
    Icon: Shield02Icon,
    accent: "text-status-safe",
  },
  {
    id: "target",
    label: "Target",
    description: "Within range — worth applying",
    Icon: Target01Icon,
    accent: "text-status-target",
  },
  {
    id: "reach",
    label: "Reach",
    description: "Below avg but possible if trend is falling",
    Icon: Rocket01Icon,
    accent: "text-status-reach",
  },
];

/** Rendering 1,400 cards at once locks the main thread on a mid-range phone. */
const PAGE_SIZE = 40;

/**
 * The report's "Generated:" line.
 *
 * Pinned to en-GB and Asia/Karachi rather than the machine locale. This string
 * is written into a downloadable file, so it must not depend on where the
 * reader happens to be — and an unpinned formatter is the same hydration
 * hazard `src/lib/format/date.ts` exists to prevent.
 */
function reportTimestamp(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Karachi",
  }).format(now);
}

export function MyPrediction({
  rows,
  policy,
  facets,
  distribution,
  initialMerit = "",
}: {
  rows: MeritRow[];
  policy: CalculatorPolicy;
  facets: {
    programs: string[];
    quotas: string[];
    specialties: string[];
    hospitals: string[];
  };
  distribution: number[];
  /** Arrives from the calculator's "Save & analyse". */
  initialMerit?: string;
}) {
  const [mode, setMode] = useState<Mode>("score");

  return (
    <div className="flex flex-col gap-6">
      {/* Mode switch, in the same two options and the same order. */}
      <div
        role="group"
        aria-label="Prediction mode"
        className="flex w-full max-w-md items-center gap-1 rounded-lg border border-border-strong bg-surface-sunken p-1"
      >
        {(
          [
            ["score", "I know my score"],
            ["target", "I have a target"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-md px-3 py-2.5 text-sm font-bold transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
              mode === value
                ? "bg-surface text-accent shadow-ambient"
                : "text-fg-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "score" ? (
        <ScoreMode
          rows={rows}
          policy={policy}
          facets={facets}
          distribution={distribution}
          initialMerit={initialMerit}
        />
      ) : (
        <TargetMode rows={rows} policy={policy} facets={facets} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function ScoreMode({
  rows,
  policy,
  facets,
  distribution,
  initialMerit,
}: {
  rows: MeritRow[];
  policy: CalculatorPolicy;
  facets: { programs: string[]; quotas: string[] };
  distribution: number[];
  initialMerit: string;
}) {
  // Pre-filled but not auto-run: arriving from the calculator should not dump
  // the reader straight into 1,400 results before they have set a quota.
  const analyzeIcon = useActionIcon();
  const [merit, setMerit] = useState(initialMerit);
  const [program, setProgram] = useState("");
  const [quota, setQuota] = useState("");
  const [filter, setFilter] = useState<"all" | Bucket>("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const [submitted, setSubmitted] = useState<{
    marks: number;
    program: string;
    quota: string;
  } | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const meritValue = Number(merit);
  const meritPct =
    merit.trim() !== "" && Number.isFinite(meritValue) && policy.totalMarks > 0
      ? (meritValue / policy.totalMarks) * 100
      : null;

  const results = useMemo(() => {
    if (!submitted) return null;
    return predict(rows, submitted.marks, policy.totalMarks, {
      program: submitted.program || undefined,
      quota: submitted.quota || undefined,
    });
  }, [rows, submitted, policy.totalMarks]);

  const counts = results ? countByBucket(results) : null;
  const userPct = submitted ? (submitted.marks / policy.totalMarks) * 100 : 0;
  const percentile = results ? percentileFor(userPct, distribution) : 0;
  const band = results ? bandFor(submitted!.marks, policy.totalMarks, distribution).band : null;
  const confidenceShare = results ? highConfidenceShare(results) : 0;

  // The bucket filter and the search apply together, and both feed the bucket
  // columns as well as the flat list — otherwise searching would appear to do
  // nothing while "All" is selected.
  const shown = useMemo(() => {
    if (!results) return [];
    const term = search.trim().toLowerCase();
    return results.filter((r) => {
      if (filter !== "all" && r.bucket !== filter) return false;
      if (!term) return true;
      return `${r.row.specialty} ${r.row.hospital}`.toLowerCase().includes(term);
    });
  }, [results, filter, search]);

  return (
    <div className="flex flex-col gap-6">
      <Bezel innerClassName="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number.isFinite(meritValue) || merit.trim() === "") return;
            setSubmitted({ marks: meritValue, program, quota });
            setVisible(PAGE_SIZE);
            setFilter("all");
            // Scrolls to the answer rather than leaving it below the fold, as
            // the original does.
            requestAnimationFrame(() =>
              resultsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            );
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="pred-merit">Merit score</FieldLabel>
              <NumberField
                id="pred-merit"
                step="0.01"
                min={0}
                max={200}
                placeholder="e.g. 28.5"
                value={merit}
                onChange={(e) => setMerit(e.target.value)}
              />
              {meritPct != null && (
                <p className="mt-2 font-mono text-[11px] font-bold text-accent">
                  = {meritPct.toFixed(1)}% of {policy.totalMarks} marks
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="pred-program">Program</FieldLabel>
              <Select
                id="pred-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">All programs</option>
                {facets.programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
              <FieldHint>
                {program
                  ? `Showing ${program} only`
                  : "All programs included — results may overlap"}
              </FieldHint>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="pred-quota">Quota</FieldLabel>
              <Select
                id="pred-quota"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              >
                <option value="">All quotas</option>
                {facets.quotas.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </Select>
              <FieldHint>
                {quota
                  ? `Showing ${quota} only`
                  : "All quotas included — same hospital may appear in multiple columns"}
              </FieldHint>
            </div>
          </div>

          <button
            type="submit"
            className="group mt-5 flex min-h-[52px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-6 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
          >
            Analyze my score
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
              <ZoomInAreaIcon ref={analyzeIcon.ref} size={ICON_SIZE_SM} />
            </span>
          </button>
        </form>
      </Bezel>

      <div ref={resultsRef} className="scroll-mt-20" />

      {results && counts && band && (
        <>
          <Bezel lifted innerClassName="p-5">
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-10">
              <div>
                <p className="font-mono text-6xl font-black tabular-nums leading-none text-accent">
                  {percentile}
                </p>
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
                  Percentile
                </p>

                {/* Also a div rather than a span: the animated icon is a
                    block-level element and cannot live in phrasing content. */}
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-sunken px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                  <SparklesIcon size={14} className="text-accent" />
                  {band.label}
                </div>

                <p className="mt-2 max-w-[22rem] text-xs leading-relaxed text-fg-muted">
                  {confidenceShare.toFixed(0)}% of predictions have high
                  confidence (4+ years of data)
                </p>
              </div>

              <div>
                <div className="grid grid-cols-3 gap-3">
                  {BUCKETS.map(({ id, label, Icon, accent }) => (
                    <div
                      key={id}
                      className="rounded-sm border border-border bg-surface-sunken/60 p-3 text-center"
                    >
                      <p
                        className={`font-mono text-2xl font-black tabular-nums ${accent}`}
                      >
                        {counts[id]}
                      </p>
                      {/* A div, not a p: the animated icons render a <div>,
                          which is invalid inside a paragraph and produces a
                          hydration error. */}
                      <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        <Icon size={14} className={accent} />
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                <ScoreDistribution
                  distribution={distribution}
                  userPct={userPct}
                  className="mt-5"
                />
              </div>
            </div>

            <p className="mt-5 border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-fg-subtle">
              Score normalised using the {policy.year} intake formula (
              {policy.totalMarks} marks max) → {userPct.toFixed(1)}% of max
            </p>
          </Bezel>

          <HowToRead />

          {!submitted!.quota && (
            <p className="rounded-sm border border-status-reach/40 bg-status-reach-quiet px-4 py-3 text-xs leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                No quota selected.
              </span>{" "}
              The same hospital may appear in multiple columns because each
              provincial quota has a different historical average. Select a
              quota for a focused view.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "safe", "target", "reach"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setVisible(PAGE_SIZE);
                }}
                className={`rounded-sm border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors duration-[150ms] ${
                  filter === value
                    ? "border-accent bg-accent-quiet text-accent"
                    : "border-border-strong text-fg-muted hover:text-foreground"
                }`}
              >
                {value === "all" ? "All" : value}
                {value !== "all" && (
                  <span className="ml-1.5 text-fg-subtle">{counts[value]}</span>
                )}
              </button>
            ))}

            {/* Free text over specialty and hospital, as the original has —
                without it, narrowing 1,400 results means scrolling. */}
            <SearchField
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Filter specialty / hospital…"
              aria-label="Filter results by specialty or hospital"
              className="min-h-[38px] w-full sm:w-64"
            />

            <div className="sm:ml-auto">
              <ExportReportButton
                context={{
                  merit: submitted!.marks,
                  totalMarks: policy.totalMarks,
                  userPct,
                  percentile,
                  band: band.label,
                  program: submitted!.program || "All Programs",
                  quota: submitted!.quota || "All Quotas",
                  counts,
                  generatedAt: reportTimestamp(),
                }}
                predictions={shown}
              />
            </div>
          </div>

          {shown.length === 0 ? (
            <Bezel innerClassName="px-8 py-14 text-center">
              <p className="font-sans text-base font-bold text-foreground">
                No combinations within reach of that score
              </p>
              <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
                Every seat on record closed more than 15 points of max
                above this score.
              </p>
            </Bezel>
          ) : filter === "all" ? (
            <HairlineGrid className="lg:grid-cols-3">
              {BUCKETS.map(({ id, label, description, Icon, accent }) => {
                const items = shown.filter((r) => r.bucket === id);
                return (
                  <HairlineCard key={id} className="flex flex-col">
                    <header className="border-b border-border p-4">
                      <div className="flex items-center gap-2">
                        <Icon size={18} className={accent} />
                        <h3 className={`font-sans text-sm font-bold ${accent}`}>
                          {label}
                        </h3>
                        <span className="ml-auto font-mono text-sm font-bold tabular-nums text-foreground">
                          {items.length}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                        {description}
                      </p>
                    </header>

                    <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto p-3">
                      {items.slice(0, visible).map((prediction) => (
                        <PredictionCard
                          key={keyFor(prediction)}
                          prediction={prediction}
                        />
                      ))}
                      {items.length === 0 && (
                        <li className="px-2 py-6 text-center text-xs text-fg-subtle">
                          Nothing in this band
                        </li>
                      )}
                      {items.length > visible && (
                        <li className="pt-1 text-center font-mono text-[11px] text-fg-subtle">
                          {(items.length - visible).toLocaleString("en-GB")} more
                        </li>
                      )}
                    </ul>
                  </HairlineCard>
                );
              })}
            </HairlineGrid>
          ) : (
            <Bezel innerClassName="p-3">
              <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {shown.slice(0, visible).map((prediction) => (
                  <PredictionCard
                    key={keyFor(prediction)}
                    prediction={prediction}
                  />
                ))}
              </ul>
            </Bezel>
          )}

          {shown.length > visible && filter !== "all" && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mx-auto rounded-sm border border-border-strong bg-surface px-6 py-3 text-sm font-bold text-fg-muted shadow-ambient transition-colors hover:border-accent hover:text-foreground"
            >
              Show more ({(shown.length - visible).toLocaleString("en-GB")} remaining)
            </button>
          )}

          {filter === "all" && results.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mx-auto rounded-sm border border-border-strong bg-surface px-6 py-3 text-sm font-bold text-fg-muted shadow-ambient transition-colors hover:border-accent hover:text-foreground"
            >
              Show more in every band
            </button>
          )}
        </>
      )}
    </div>
  );
}

function keyFor(p: Prediction) {
  const { row } = p;
  return `${row.program}|${row.quota}|${row.specialty}|${row.hospital}`;
}

/** The original's legend, item for item. */
function HowToRead() {
  return (
    <Bezel innerClassName="p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
        How to read a card
      </p>

      <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Legend term="Safe" desc="your score comfortably exceeds avg" />
        <Legend term="Avg: 49.3%" desc="historical average closing merit (as % of max marks)" mono />
        <Legend term="Target" desc="within ±5% of avg, worth applying" />
        <Legend
          term="+25.1%"
          desc="your score minus avg — green = above avg, amber = below avg"
          mono
        />
        <Legend term="Reach" desc="avg is higher, but trend may help" />
        <Legend
          term="↓ 47.8–50.8%"
          desc="projected range for next induction — ↓ falling or ↑ rising trend"
          mono
        />
        <Legend
          term="Low / Medium / High"
          desc="confidence based on years of data available (4+ yrs = High)"
        />
      </div>
    </Bezel>
  );
}

function Legend({
  term,
  desc,
  mono = false,
}: {
  term: string;
  desc: string;
  mono?: boolean;
}) {
  return (
    <p className="text-xs leading-relaxed text-fg-muted">
      <span
        className={`font-bold text-foreground ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {term}
      </span>{" "}
      — {desc}
    </p>
  );
}

/* ------------------------------------------------------------------------ */

function TargetMode({
  rows,
  policy,
  facets,
}: {
  rows: MeritRow[];
  policy: CalculatorPolicy;
  facets: {
    programs: string[];
    quotas: string[];
    specialties: string[];
    hospitals: string[];
  };
}) {
  const requirementsIcon = useActionIcon();
  const [program, setProgram] = useState("");
  const [quota, setQuota] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospital, setHospital] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requirements = useMemo(() => {
    if (!submitted || !specialty) return null;
    const matching = rows.filter(
      (row) =>
        (!program || row.program === program) &&
        (!quota || row.quota === quota) &&
        row.specialty === specialty &&
        (!hospital || row.hospital === hospital)
    );
    return requirementsFor(matching, policy.totalMarks);
  }, [submitted, rows, program, quota, specialty, hospital, policy.totalMarks]);

  return (
    <div className="flex flex-col gap-6">
      <Bezel innerClassName="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="rev-program">Program</FieldLabel>
              <Select
                id="rev-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">Select program</option>
                {facets.programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="rev-quota">Quota</FieldLabel>
              <Select
                id="rev-quota"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              >
                <option value="">Select quota</option>
                {facets.quotas.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="rev-specialty">Specialty</FieldLabel>
              <Select
                id="rev-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                required
              >
                <option value="">Select specialty</option>
                {facets.specialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="rev-hospital">Hospital (optional)</FieldLabel>
              <Select
                id="rev-hospital"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
              >
                <option value="">All hospitals</option>
                {facets.hospitals.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <button
            type="submit"
            className="group mt-5 flex min-h-[52px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-6 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
          >
            Show requirements
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
              <ZoomInAreaIcon ref={requirementsIcon.ref} size={ICON_SIZE_SM} />
            </span>
          </button>

          {submitted && !specialty && (
            <p className="mt-3 font-mono text-[11px] text-status-reach">
              Please select at least a specialty.
            </p>
          )}
        </form>
      </Bezel>

      {requirements?.length === 0 && (
        <Bezel innerClassName="px-8 py-14 text-center">
          <p className="text-sm text-fg-muted">
            No data found for this combination.
          </p>
        </Bezel>
      )}

      {requirements?.map((req) => (
        <Bezel key={keyFor({ row: req.row } as Prediction)} innerClassName="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-sans text-base font-bold text-accent">
                {req.row.specialty}
              </h3>
              <p className="mt-0.5 text-xs text-fg-muted">
                {req.row.hospital} · {req.row.program} · {req.row.quota}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                Seats (latest)
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                {req.seats ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Average cutoff"
              value={`${req.avgPct.toFixed(1)}%`}
              sub={`${((req.avgPct / 100) * policy.totalMarks).toFixed(2)} / ${policy.totalMarks}`}
            />
            <Metric
              label="Latest cutoff"
              value={req.latestPct != null ? `${req.latestPct.toFixed(1)}%` : "—"}
              sub={
                req.latestRaw != null
                  ? `${req.latestRaw.toFixed(2)} raw`
                  : undefined
              }
            />
            <Metric
              label="Projected range"
              value={`${req.projectedLow}–${req.projectedHigh}%`}
              sub={`${((req.projectedLow / 100) * policy.totalMarks).toFixed(2)}–${((req.projectedHigh / 100) * policy.totalMarks).toFixed(2)} / ${policy.totalMarks}`}
            />
            <Metric
              label="You need (safe)"
              value={req.neededMarks.toFixed(2)}
              sub={`out of ${policy.totalMarks} marks`}
              highlight
            />
          </div>
        </Bezel>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-bold tabular-nums ${
          highlight ? "text-status-safe" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[10px] text-fg-subtle">{sub}</p>
      )}
    </div>
  );
}
