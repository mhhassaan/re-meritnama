"use client";

import { useMemo, useState } from "react";
import {
  CHANGE_PRESETS,
  type CandidateChange,
  type ChangeKind,
  type FieldChange,
} from "@/lib/portal/data-changes-fields";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { Pill } from "@/components/portal/portal-terms";
import { LoadMore } from "@/components/portal/load-more";

const BATCH = 30;

/** Programme marks are integers; every merit component is a four-decimal mark. */
const mark = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(4);

const KIND_LABEL: Record<ChangeKind, string> = {
  appeared: "Record filled in",
  vanished: "Record blanked",
  revised: "Marks revised",
  added: "New applicant",
};

const KIND_TONE: Record<ChangeKind, "safe" | "danger" | "reach" | "accent"> = {
  appeared: "safe",
  vanished: "danger",
  revised: "reach",
  added: "accent",
};

/**
 * One field's movement, rendered per field type.
 *
 * `appliedIn` stores booleans as 0 and 1, so printing the raw numbers would
 * show "0 → 1" where the fact is "did not apply → applied". The original
 * prints the whole programme object as JSON on both sides
 * (`{"FCPS":false,…} → {"FCPS":true,…}`), which makes the reader diff five
 * keys by eye to find the one that moved.
 */
function ChangeLine({ change }: { change: FieldChange }) {
  const label = change.program
    ? `${change.label} · ${change.program}`
    : change.label;

  let body: React.ReactNode;

  if (change.field === "name" || change.field === "record") {
    // No values by design — see the migration. The fact is the whole content.
    body = (
      <span className="text-fg-muted">
        {change.field === "record"
          ? "Added to the applicant file"
          : change.kind === "appeared"
            ? "Name added to the record"
            : change.kind === "vanished"
              ? "Name cleared from the record"
              : "Name corrected"}
      </span>
    );
  } else if (change.field.startsWith("pref") && change.field !== "prefCount") {
    // A count, not a movement. The seats themselves are on the Candidate Pool
    // — see the ingest script for why they are not duplicated here.
    body = (
      <span className="font-mono font-bold text-foreground">
        {change.newValue ?? 0}
      </span>
    );
  } else if (change.field === "appliedIn") {
    body = (
      <span className="font-mono">
        {change.newValue ? "applied" : "withdrawn"}
      </span>
    );
  } else {
    body = (
      <span className="font-mono">
        <span className="text-fg-subtle">{mark(change.oldValue ?? 0)}</span>
        <span className="mx-2 text-fg-subtle">&rarr;</span>
        <span className="font-bold text-foreground">
          {mark(change.newValue ?? 0)}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border py-2 first:border-t-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </span>
      <span className="text-[13px]">{body}</span>
    </div>
  );
}

function CandidateRow({ candidate }: { candidate: CandidateChange }) {
  const [open, setOpen] = useState(false);

  return (
    <Bezel innerClassName="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-surface-sunken"
      >
        <span className="font-mono text-[11px] font-bold text-accent">
          {candidate.applicantId}
        </span>

        <span className="min-w-0 flex-1 truncate font-sans text-sm font-bold text-foreground">
          {candidate.name ?? (
            <span className="font-mono text-xs font-normal text-fg-subtle">
              Applicant {candidate.applicantId}
            </span>
          )}
        </span>

        {candidate.marksKind && (
          <Pill tone={KIND_TONE[candidate.marksKind]}>
            {KIND_LABEL[candidate.marksKind]}
          </Pill>
        )}

        {candidate.marksDelta != null && candidate.marksKind === "revised" && (
          <span
            className={`font-mono text-[13px] font-bold ${
              candidate.marksDelta >= 0 ? "text-hope" : "text-status-reach"
            }`}
          >
            {candidate.marksDelta >= 0 ? "+" : ""}
            {candidate.marksDelta.toFixed(4)}
          </span>
        )}

        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
          {candidate.changes.length}{" "}
          {candidate.changes.length === 1 ? "field" : "fields"}
          <span className="ml-2 inline-block">{open ? "−" : "+"}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-3">
          {candidate.changes.map((change) => (
            <ChangeLine
              key={`${change.field}:${change.program ?? ""}`}
              change={change}
            />
          ))}
        </div>
      )}
    </Bezel>
  );
}

export function DataChangesBrowser({
  candidates,
}: {
  candidates: CandidateChange[];
}) {
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<string>("all");
  const [kind, setKind] = useState<string>("");
  const [sort, setSort] = useState<"change" | "id" | "name">("change");
  const [shown, setShown] = useState(BATCH);

  // Compared during render rather than in an effect: an effect would paint one
  // frame of the previous filter's batch before resetting it.
  const signature = `${search}|${preset}|${kind}|${sort}`;
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setShown(BATCH);
  }

  const matched = useMemo(() => {
    const fields = CHANGE_PRESETS.find((p) => p.id === preset)?.fields ?? null;
    const term = search.trim().toLowerCase();

    const rows = candidates.filter((candidate) => {
      if (fields && !candidate.changes.some((c) => fields.includes(c.field))) {
        return false;
      }
      if (kind && candidate.marksKind !== kind) return false;
      if (term) {
        const hit =
          String(candidate.applicantId).includes(term) ||
          candidate.name?.toLowerCase().includes(term);
        if (!hit) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sort === "id") return a.applicantId - b.applicantId;
      if (sort === "name") {
        // Unnamed last. An empty string sorts above every real name and would
        // fill the top of the list with placeholders.
        if (!a.name && !b.name) return a.applicantId - b.applicantId;
        if (!a.name) return 1;
        if (!b.name) return -1;
        return a.name.localeCompare(b.name);
      }
      return Math.abs(b.marksDelta ?? 0) - Math.abs(a.marksDelta ?? 0);
    });
  }, [candidates, search, preset, kind, sort]);

  return (
    <>
      <Bezel className="mt-8" innerClassName="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="dc-search">Search</FieldLabel>
            <SearchField
              id="dc-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Applicant id or name…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="dc-kind">Total marks moved</FieldLabel>
            <Select
              id="dc-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Any way, or not at all</option>
              <option value="revised">Revised between two real marks</option>
              <option value="appeared">Record filled in (0 to a mark)</option>
              <option value="vanished">Record blanked (a mark to 0)</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="dc-sort">Sort</FieldLabel>
            <Select
              id="dc-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="change">Biggest change first</option>
              <option value="id">By applicant id</option>
              <option value="name">By name</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {CHANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              aria-pressed={preset === p.id}
              className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                preset === p.id
                  ? "border-accent bg-accent-quiet font-bold text-accent"
                  : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Bezel>

      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">
          {matched.length.toLocaleString("en-GB")}
        </span>{" "}
        {matched.length === 1 ? "candidate" : "candidates"} match
      </p>

      {matched.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-16 text-center">
          <p className="font-sans text-base font-bold text-foreground">
            Nothing matches
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Try a different change type, or clear the search. Only candidates
            whose record moved between the two snapshots appear here at all.
          </p>
        </Bezel>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {matched.slice(0, shown).map((candidate) => (
              <CandidateRow key={candidate.applicantId} candidate={candidate} />
            ))}
          </div>

          <LoadMore
            shown={Math.min(shown, matched.length)}
            total={matched.length}
            noun="candidates"
            onClick={() => setShown((v) => v + BATCH)}
          />
        </>
      )}
    </>
  );
}
