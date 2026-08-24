"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  CalculatorInput,
  CalculatorPolicy,
  CalculatorResult,
  PolicyComponent,
} from "@/lib/calculator/types";
import {
  FCPS_ATTEMPT_KEY,
  FCPS_TYPE_KEY,
  JCAT_PCT_KEY,
  bandFor,
  scoreAll,
} from "@/lib/calculator/score";
import { Bezel } from "@/components/app/bezel";
import { FieldHint, NumberField, Select } from "@/components/app/field";
import {
  AlertIcon,
  ChartIcon,
  DocumentIcon,
  HouseIcon,
  InfoIcon,
  PercentIcon,
  SaveIcon,
  SealIcon,
  TrophyIcon,
} from "@/components/icons/koboyo";
import { MagicWand01Icon } from "@/components/ui/magic-wand-01";
import { RefreshIcon } from "@/components/ui/refresh";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The merit calculator.
 *
 * Renders whatever the policy says: the component list, their maxima and their
 * scoring all come from the data, so a formula change is a data refresh rather
 * than a code change. That matters here — the formula was rewritten wholesale
 * between Induction 20 and 21.
 *
 * The result is computed on submit rather than live as you type. A number that
 * updates on every keystroke invites reading a half-entered form as an answer,
 * and this is a figure people make decisions on.
 */

/** Icons are per component key, so a new component falls back rather than breaks. */
const COMPONENT_ICONS: Record<
  string,
  (props: { className?: string }) => React.ReactElement
> = {
  mdcat: PercentIcon,
  mbbs_bds_degree: DocumentIcon,
  university_positions: TrophyIcon,
  house_job: HouseIcon,
  fcps_jcat: SealIcon,
};

export function MeritCalculator({
  policy,
  distribution,
}: {
  policy: CalculatorPolicy;
  distribution: number[];
}) {
  const [input, setInput] = useState<CalculatorInput>({});
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const calcIcon = useActionIcon();
  const resetIcon = useActionIcon();

  const included = useMemo(
    () => policy.components.filter((c) => c.included),
    [policy]
  );
  const removed = useMemo(
    () => policy.components.filter((c) => !c.included),
    [policy]
  );

  const set = (key: string, value: string) =>
    setInput((current) => ({ ...current, [key]: value }));

  const banded = result
    ? bandFor(result.total, result.totalMarks, distribution)
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* What formula is being applied, stated before anything is entered. */}
      <Bezel innerClassName="p-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* The year, not the induction number — the standing rule for every
              user-facing cycle label. The quoted `notes` and `policyRef` below
              keep their original wording, because they are citations of the
              notification rather than our own labelling. */}
          <span className="rounded-full border border-accent/40 bg-accent-quiet px-3 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-accent">
            {policy.year}
          </span>
          <h2 className="font-sans text-lg font-bold text-foreground">
            Formula for the {policy.year} intake · {policy.totalMarks} marks
          </h2>
        </div>

        {policy.notes && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
            {policy.notes}
          </p>
        )}

        {policy.policyRef && (
          <p className="mt-2 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-fg-subtle">
            <InfoIcon className="mt-px h-3.5 w-auto shrink-0" />
            {policy.policyRef}
          </p>
        )}
      </Bezel>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResult(scoreAll(policy, input));
        }}
        className="flex flex-col gap-6"
      >
        {/* `items-start` matters: without it grid items stretch to the tallest
            in the row, so choosing FCPS Part-I — which reveals a second field —
            grew the House Job card beside it by 100 px. Each card is now its
            own height and only the card you touched changes. */}
        <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {included.map((component) => (
            <ComponentField
              key={component.key}
              component={component}
              input={input}
              onChange={set}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            {...calcIcon.handlers}
            className="group flex min-h-[52px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-6 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
          >
            Calculate merit
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
              <MagicWand01Icon ref={calcIcon.ref} size={ICON_SIZE_SM} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInput({});
              setResult(null);
            }}
            {...resetIcon.handlers}
            className="flex min-h-[52px] items-center gap-2 rounded-sm border border-border-strong bg-surface px-5 text-sm font-bold text-fg-muted transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent hover:text-foreground active:scale-[0.98]"
          >
            <RefreshIcon ref={resetIcon.ref} size={ICON_SIZE_SM} />
            Reset
          </button>
        </div>
      </form>

      {result && banded && (
        <Bezel lifted innerClassName="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border p-5">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
                Estimated merit score
              </p>
              <p className="mt-2 font-mono text-5xl font-black tabular-nums text-accent sm:text-6xl">
                {result.total.toFixed(2)}
                <span className="ml-2 font-mono text-xl font-bold text-fg-subtle">
                  / {result.totalMarks}
                </span>
              </p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-sunken px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                <TrophyIcon className="h-4 w-auto text-accent" />
                {banded.band.label}
              </span>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-fg-muted">
                {banded.band.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-5">
            {result.breakdown.map((row) => {
              const fill = row.max > 0 ? (row.earned / row.max) * 100 : 0;
              return (
                <div
                  key={row.key}
                  className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_8rem_5.5rem]"
                >
                  <span className="text-[13px] font-bold text-foreground">
                    {row.label}
                  </span>
                  <span className="font-mono text-[11px] text-fg-muted">
                    {row.value}
                  </span>
                  {/* The bar is the same information as the numbers beside it,
                      so it is decorative and hidden from screen readers. */}
                  <span
                    aria-hidden
                    className="hidden h-1.5 overflow-hidden rounded-full bg-surface-sunken sm:block"
                  >
                    <span
                      className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                      style={{ width: `${fill}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-xs font-bold tabular-nums text-foreground">
                    {row.earned.toFixed(2)}
                    <span className="text-fg-subtle"> / {row.max}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stated in full rather than shown as a bare percentile, because a
              percentile next to a merit score reads as a chance of a seat. */}
          <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-fg-muted">
            This score sits above{" "}
            <span className="font-mono font-bold text-foreground">
              {banded.percentile.toFixed(0)}%
            </span>{" "}
            of the {distribution.length.toLocaleString("en-GB")} historical
            closing merits on record, compared on the same normalised scale. That
            is a position among past results, <em>not</em> a probability of
            getting a seat — seats, applicant numbers and the formula all change
            between cycles.
          </p>

          {/* Carries the score to the predictor, as the original's
              "Save & Analyze" does. The score travels in the URL rather than
              storage: it is the user's own figure, it is not sensitive, and a
              link that reproduces the result is shareable and back-button
              friendly in a way a stashed value is not. */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border p-5">
            <Link
              href={`/app/prediction?merit=${result.total}`}
              className="group flex min-h-[48px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
            >
              <SaveIcon className="h-4 w-auto" />
              Save &amp; analyse
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <ChartIcon className="h-4 w-auto" />
              </span>
            </Link>
            <p className="font-mono text-[11px] text-fg-subtle">
              Opens My Prediction with this score filled in.
            </p>
          </div>
        </Bezel>
      )}

      {removed.length > 0 && (
        <Bezel innerClassName="p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            No longer counted
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-fg-muted">
            These carried marks in earlier cycles and carry none in this one.
            Listed rather than hidden, because a candidate who scored well on one
            of them deserves to see that it no longer counts.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {removed.map((component) => (
              <li
                key={component.key}
                title={component.description}
                className="rounded-sm border border-border bg-surface-sunken px-2.5 py-1 font-mono text-[11px] text-fg-subtle line-through decoration-fg-subtle/50"
              >
                {component.label}
              </li>
            ))}
          </ul>
        </Bezel>
      )}

      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-fg-subtle">
        <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
        <span>
          <span className="font-bold text-status-reach">Disclaimer.</span> This
          calculator follows the publicly known PHF policy components. Your
          actual merit as calculated by PHF may differ through rounding,
          verification, or a policy update. Always verify your official score
          directly with PHF.
        </span>
      </p>
    </div>
  );
}

/** One component of the formula, rendered by its declared type. */
function ComponentField({
  component,
  input,
  onChange,
}: {
  component: PolicyComponent;
  input: CalculatorInput;
  onChange: (key: string, value: string) => void;
}) {
  const Icon = COMPONENT_ICONS[component.key] ?? DocumentIcon;
  const inputId = `calc-${component.key}`;

  return (
    <Bezel innerClassName="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-5 w-auto shrink-0 text-accent" />
          <label
            htmlFor={inputId}
            className="font-sans text-sm font-bold leading-snug text-foreground"
          >
            {component.label}
          </label>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-sunken px-2.5 py-1 font-mono text-[10px] font-bold leading-none text-fg-muted">
          {component.max_marks} pts
        </span>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-fg-muted">
        {component.description}
      </p>

      <div className="pt-4">
        <Field component={component} input={input} onChange={onChange} inputId={inputId} />
      </div>
    </Bezel>
  );
}

function Field({
  component,
  input,
  onChange,
  inputId,
}: {
  component: PolicyComponent;
  input: CalculatorInput;
  onChange: (key: string, value: string) => void;
  inputId: string;
}) {
  const { key, type, max_marks } = component;

  if (type === "tiered_select") {
    return (
      <>
        <Select
          id={inputId}
          value={input[key] ?? ""}
          onChange={(e) => onChange(key, e.target.value)}
        >
          <option value="">— Select —</option>
          {component.tiers?.map((tier) => (
            <option key={tier.label} value={String(tier.value)}>
              {tier.label}
            </option>
          ))}
        </Select>
        <Hint>Max: {max_marks} marks</Hint>
      </>
    );
  }

  if (type === "fcps_jcat_combo") {
    const qualification = input[FCPS_TYPE_KEY(key)] ?? "";

    return (
      <div className="flex flex-col gap-3">
        <Select
          id={inputId}
          value={qualification}
          onChange={(e) => onChange(FCPS_TYPE_KEY(key), e.target.value)}
        >
          <option value="">— Select qualification —</option>
          <option value="fcps">FCPS Part-I</option>
          <option value="jcat">JCAT (passed before March 2026)</option>
          <option value="none">Neither / not applicable</option>
        </Select>

        {/* The follow-up only appears once it applies. Showing an attempt
            selector to someone who sat JCAT is a question they cannot answer. */}
        {qualification === "fcps" && (
          <div>
            <Select
              aria-label="FCPS Part-I attempt"
              value={input[FCPS_ATTEMPT_KEY(key)] ?? ""}
              onChange={(e) => onChange(FCPS_ATTEMPT_KEY(key), e.target.value)}
            >
              <option value="">— Select attempt number —</option>
              {component.fcps_tiers?.map((tier) => (
                <option key={tier.label} value={tier.label}>
                  {tier.label} — {tier.marks} mark{tier.marks === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
            <Hint>
              Marks by attempt:{" "}
              {component.fcps_tiers
                ?.map((t) => `${t.label} = ${t.marks}`)
                .join(", ")}
            </Hint>
          </div>
        )}

        {qualification === "jcat" && (
          <div>
            <NumberField
              step="0.01"
              min={0}
              max={100}
              suffix="%"
              aria-label="JCAT percentage"
              placeholder="e.g. 72.5"
              value={input[JCAT_PCT_KEY(key)] ?? ""}
              onChange={(e) => onChange(JCAT_PCT_KEY(key), e.target.value)}
            />
            <Hint>
              {component.jcat_thresholds
                ?.map((t) => `${t.label} = ${t.value}`)
                .join(" · ")}
            </Hint>
          </div>
        )}
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <>
        <Select
          id={inputId}
          value={input[key] ?? ""}
          onChange={(e) => onChange(key, e.target.value)}
        >
          <option value="">— Select —</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
        <Hint>Max: {max_marks} marks</Hint>
      </>
    );
  }

  const placeholder =
    type === "count" ? "0" : type === "years" ? "0" : "e.g. 72.5";

  // A unit inside the control, so the field reads as a measurement rather than
  // a bare box the user has to infer the units of from the hint below it.
  const suffix =
    type === "percentage"
      ? "%"
      : type === "count"
        ? "pos"
        : type === "years"
          ? "yrs"
          : undefined;

  const hint =
    type === "percentage"
      ? `Enter a percentage · Max: ${max_marks} marks`
      : type === "count"
        ? `${component.per_item ?? 1} mark(s) each · Max: ${max_marks} marks`
        : type === "years"
          ? `${component.per_year ?? 1} mark(s) per year · Max: ${max_marks} marks`
          : `Max: ${max_marks} marks`;

  return (
    <>
      <NumberField
        id={inputId}
        step="0.01"
        min={0}
        max={type === "percentage" ? 100 : undefined}
        suffix={suffix}
        placeholder={placeholder}
        value={input[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
      />
      <Hint>{hint}</Hint>
    </>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <FieldHint>{children}</FieldHint>;
}
