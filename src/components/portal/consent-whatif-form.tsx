"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  ConsentMode,
  ConsentReport,
  ConsentWhatIfResult,
} from "@/lib/portal/consent-whatif";
import { runConsentWhatIfAction } from "@/lib/portal/consent-whatif-action";
import { useIdentifiedApplicant } from "@/components/portal/find-me-bar";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, NumberField, Select } from "@/components/app/field";
import { Pill } from "@/components/portal/portal-terms";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { AlertIcon } from "@/components/icons/koboyo";
import { PlayIcon } from "@/components/ui/play";
import { Search01Icon } from "@/components/ui/search-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The Consent What-If form, its report, and the scenario history beneath it.
 *
 * Everything on this page stays in the browser. The applicant id and
 * programme picked here are never written anywhere — the report is
 * recomputed on the server each time Run is pressed and handed back, not
 * persisted, and the "scenario record" below is `localStorage` only, the
 * same pattern `FindMeBar` and `AddMeModal` already use for the same reason:
 * an applicant id is not a secret, but a server-side log of who has been
 * asking "what if" about whom is not something this page needs to hold.
 */

const HISTORY_KEY = "mn_consent_whatif_history";
const MAX_HISTORY = 8;

type HistoryEntry = {
  id: string;
  createdAt: number;
  program: string;
  candidateId: number;
  report: ConsentReport;
};

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

const ERROR_TEXT: Record<Exclude<ConsentWhatIfResult, { ok: true }>["reason"], string> = {
  unverified: "Verify your identity to run this.",
  "not-found": "That applicant ID was not found in the candidate pool.",
  "not-in-program": "This candidate did not apply to that programme.",
  "outside-scope": "This candidate is outside the active status scope on the Config tab.",
};

export function ConsentWhatIfForm({ programs }: { programs: string[] }) {
  const me = useIdentifiedApplicant();

  const [program, setProgram] = useState(programs[0] ?? "");
  const [candidateId, setCandidateId] = useState("");
  const [report, setReport] = useState<ConsentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const noConsentIcon = useActionIcon();
  const consentIcon = useActionIcon();
  const useMeIcon = useActionIcon();

  useEffect(() => setHistory(loadHistory()), []);

  function run(mode: ConsentMode) {
    const id = Number(candidateId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Enter the Applicant ID to simulate consent or no consent.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await runConsentWhatIfAction(program, id, mode);
      if (!result.ok) {
        setError(ERROR_TEXT[result.reason]);
        setReport(null);
        return;
      }
      setReport(result.report);
      const entry: HistoryEntry = {
        id: `${Date.now()}_${id}_${program}`,
        createdAt: Date.now(),
        program,
        candidateId: id,
        report: result.report,
      };
      setHistory((prev) => {
        const next = [entry, ...prev.filter((h) => h.id !== entry.id)].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    });
  }

  return (
    <>
      <Bezel className="mt-8" innerClassName="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="cw-program">Programme</FieldLabel>
            <Select id="cw-program" value={program} onChange={(e) => setProgram(e.target.value)}>
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="cw-id">Applicant ID</FieldLabel>
            <NumberField
              id="cw-id"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="e.g. 39236"
              min={1}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                if (me) setCandidateId(String(me));
              }}
              disabled={!me}
              {...useMeIcon.handlers}
              className="flex min-h-[46px] items-center gap-2 rounded-sm border border-border-strong px-4 text-sm font-bold text-foreground transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search01Icon ref={useMeIcon.ref} size={ICON_SIZE_SM} />
              Use my ID
            </button>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
          If this candidate is removed from the pool for the selected
          programme, which seats and candidates change.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={() => run("no-consent")}
            disabled={pending}
            {...noConsentIcon.handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Running…" : "Run: candidate does not consent"}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <PlayIcon ref={noConsentIcon.ref} size={ICON_SIZE_SM} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => run("consent")}
            disabled={pending}
            {...consentIcon.handlers}
            className="flex min-h-[46px] items-center gap-2 rounded-sm border border-border-strong px-5 text-sm font-bold text-foreground transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlayIcon ref={consentIcon.ref} size={ICON_SIZE_SM} />
            Show if candidate consents
          </button>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-status-danger">
            <AlertIcon className="mt-px h-3.5 w-auto shrink-0" />
            {error}
          </p>
        )}
      </Bezel>

      {report && <ConsentReportView report={report} />}

      <HistoryList
        history={history}
        onOpen={(entry) => {
          setProgram(entry.program);
          setCandidateId(String(entry.candidateId));
          setReport(entry.report);
          setError(null);
        }}
        onClear={() => {
          setHistory([]);
          window.localStorage.removeItem(HISTORY_KEY);
        }}
      />
    </>
  );
}

function ConsentReportView({ report }: { report: ConsentReport }) {
  const noConsent = report.mode === "no-consent";
  // The target's own row is always first in the (sorted, capped) list when it
  // exists, so it is never lost to the cap — safe to subtract its count from
  // the true total rather than from the capped one.
  const targetRows = report.changedCandidates.filter((c) => c.isTarget).length;
  const othersChanged = Math.max(0, report.changedCandidateCount - targetRows);
  const delta = report.variantPlacedCount - report.baselinePlacedCount;

  return (
    <>
      {/* ── Summary ────────────────────────────────────────────────────── */}
      <Bezel
        className="mt-6"
        innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
      >
        <Meta label="Programme" value={report.program} />
        <Meta
          label="Released slots"
          value={String(noConsent ? report.releasedSlots.length : 0)}
        />
        <Meta label="Others changed" value={othersChanged.toLocaleString("en-GB")} />
        <Meta
          label="Placed-count delta"
          value={`${delta >= 0 ? "+" : ""}${delta}`}
          tone={delta > 0 ? "text-status-safe" : delta < 0 ? "text-status-danger" : undefined}
        />
      </Bezel>

      {/* ── The candidate ──────────────────────────────────────────────── */}
      <Bezel className="mt-4" innerClassName="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-sans text-base font-bold text-foreground">
            {report.candidateName ?? `Applicant ${report.candidateId}`}
          </p>
          <Pill tone={noConsent ? "danger" : "safe"}>
            {noConsent ? "No consent scenario" : "Consent scenario"}
          </Pill>
        </div>
        <p className="mt-1 font-mono text-[11px] text-fg-muted">
          ID {report.candidateId} · {report.program} marks{" "}
          {report.candidateMarks != null ? report.candidateMarks.toFixed(2) : "—"} · Status
          scope: {report.statusLabel}
        </p>

        {report.baselinePlaced.length === 0 ? (
          <p className="mt-3 font-mono text-[11px] text-fg-subtle">
            This candidate is not placed in the baseline run.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {report.baselinePlaced.map((ref) => (
              <PlacementRow
                key={`${ref.track}-${ref.specialty}-${ref.hospital}`}
                ref={ref}
                label={noConsent ? "Baseline if consented" : "Projected"}
              />
            ))}
          </ul>
        )}
      </Bezel>

      {/* ── Released seat and who moves in ─────────────────────────────── */}
      <section className="mt-6">
        <h2 className="font-sans text-lg font-bold text-foreground">
          Released seat and who moves in
        </h2>
        {report.releasedSlots.length === 0 ? (
          <Bezel className="mt-3" innerClassName="p-5">
            <p className="font-mono text-[11px] text-fg-subtle">
              {noConsent
                ? "No occupied seat was released — this candidate was not placed."
                : "Consent keeps the normal allocation unchanged."}
            </p>
          </Bezel>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {report.releasedSlots.map((slot) => (
              <Bezel
                key={`${slot.track}-${slot.specialty}-${slot.hospital}`}
                innerClassName="p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <SpecialtyLabel specialty={slot.specialty} className="text-[13px]" />
                  <Pill tone="reach">{slot.track === "armed" ? "Armed" : "Civilian"}</Pill>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {slot.hospital} · {slot.quota} · vacated by{" "}
                  {report.candidateName ?? `Applicant ${report.candidateId}`}
                </p>

                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
                  Incoming
                </p>
                {slot.incoming.length === 0 ? (
                  <p className="mt-1.5 font-mono text-[11px] text-fg-subtle">
                    No new occupant found in this slot.
                  </p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {slot.incoming.map((person) => (
                      <li
                        key={`${person.applicantId}-${person.track}`}
                        className="flex flex-wrap items-baseline gap-x-2 text-[13px]"
                      >
                        <span className="font-bold text-foreground">
                          {person.name ?? `Applicant ${person.applicantId}`}
                        </span>
                        <span className="font-mono text-[10px] text-fg-subtle">
                          {person.mark.toFixed(2)} · P{person.preferenceNo}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Bezel>
            ))}
          </div>
        )}
      </section>

      {/* ── Changed subsequent list ────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="font-sans text-lg font-bold text-foreground">
          Changed subsequent list
        </h2>
        {report.changedCandidates.length === 0 ? (
          <Bezel className="mt-3" innerClassName="p-5">
            <p className="font-mono text-[11px] text-fg-subtle">
              No placement changes detected.
            </p>
          </Bezel>
        ) : (
          <Bezel className="mt-3" innerClassName="divide-y divide-border/60">
            {report.changedCandidates.map((change) => (
              <div
                key={`${change.applicantId}-${change.kind}`}
                className={`flex flex-wrap items-start justify-between gap-3 p-4 ${
                  change.isTarget ? "bg-hope/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-sans text-sm font-bold text-foreground">
                      {change.name ?? `Applicant ${change.applicantId}`}
                    </span>
                    <span className="font-mono text-[10px] text-fg-subtle">
                      ID {change.applicantId}
                    </span>
                    {change.isTarget && <Pill tone="accent">this candidate</Pill>}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-fg-muted">
                    Before: {placementText(change.before)}
                  </p>
                  <p className="font-mono text-[11px] text-fg-muted">
                    After: {placementText(change.after)}
                  </p>
                </div>
                <Pill
                  tone={
                    change.kind === "gain"
                      ? "safe"
                      : change.kind === "remove"
                        ? "danger"
                        : "reach"
                  }
                >
                  {change.kind === "gain"
                    ? "Newly placed"
                    : change.kind === "remove"
                      ? "No longer placed"
                      : "Moved"}
                </Pill>
              </div>
            ))}
          </Bezel>
        )}

        {report.changedCandidateCount > report.changedCandidates.length && (
          <p className="mt-3 font-mono text-[10px] text-fg-subtle">
            Showing the first {report.changedCandidates.length} of{" "}
            {report.changedCandidateCount.toLocaleString("en-GB")} changed records.
          </p>
        )}
      </section>
    </>
  );
}

function PlacementRow({
  ref,
  label,
}: {
  ref: ConsentReport["baselinePlaced"][number];
  label: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13px]">
      <SpecialtyLabel specialty={ref.specialty} className="text-[13px]" />
      <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
        @ {ref.hospital} ({ref.quota})
      </span>
      <span className="font-mono text-xs font-bold tabular-nums text-accent">
        {ref.mark.toFixed(2)}
      </span>
      <span className="font-mono text-[10px] text-fg-subtle">P{ref.preferenceNo}</span>
      <Pill tone="plain">{label}</Pill>
    </li>
  );
}

function placementText(ref: ConsentReport["baselinePlaced"][number] | null): string {
  if (!ref) return "Not in pool";
  return `${ref.specialty} @ ${ref.hospital} (${ref.quota}, P${ref.preferenceNo})`;
}

function HistoryList({
  history,
  onOpen,
  onClear,
}: {
  history: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-fg-muted">
          Scenario record
        </h2>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle underline transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="mt-3 font-mono text-[11px] text-fg-subtle">
          No scenarios yet. Run a consent / no-consent comparison and it will
          be kept here on this device.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {history.map((entry) => {
            const targetChanges = entry.report.changedCandidates.filter(
              (c) => c.isTarget
            ).length;
            const changed = Math.max(
              0,
              entry.report.changedCandidateCount - targetChanges
            );
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpen(entry)}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-border-strong px-4 py-3 text-left transition-colors hover:border-accent"
              >
                <span className="min-w-0">
                  <span className="font-sans text-sm font-bold text-foreground">
                    {entry.report.candidateName ?? `Applicant ${entry.candidateId}`}
                  </span>
                  <span className="ml-2 font-mono text-[10px] text-fg-subtle">
                    {entry.program} ·{" "}
                    {entry.report.mode === "no-consent" ? "No consent" : "Consent"} ·{" "}
                    {new Date(entry.createdAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-fg-subtle">
                  {entry.report.releasedSlots.length} released · {changed} other
                  {changed === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${tone ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
