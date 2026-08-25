"use client";

import { useEffect, useMemo, useState } from "react";
import { useFilterNav } from "@/components/app/use-filter-nav";
import { Bezel } from "@/components/app/bezel";
import { FilterPending } from "@/components/app/filter-pending";
import { FieldLabel, Select } from "@/components/app/field";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { TargetIcon } from "@/components/icons/koboyo";
import { Search01Icon } from "@/components/ui/search-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";
import { useManualCandidate } from "@/components/portal/add-me-modal";
import { slotWithManual } from "@/lib/portal/allocation-action";
import { MANUAL_ID_BASE } from "@/lib/portal/manual-candidate";

/**
 * The slot browser.
 *
 * Selection lives in the URL: the simulation runs on the server, so a change of
 * seat is a navigation either way, and a URL that reproduces the view is worth
 * having when someone wants to send it to a colleague.
 *
 * The pickers cascade. Specialty is limited to what the chosen quota offers and
 * hospital to what the chosen specialty offers, because offering a combination
 * with no seat behind it produces an empty result that reads as a bug.
 */

type Row = {
  applicantId: number;
  name: string | null;
  mark: number;
  preferenceNo: number;
  selected: boolean;
  placedHigher: boolean;
};

type Slot = {
  quota: string;
  specialty: string;
  hospital: string;
  capacity: number;
};

export function SlotBrowser({
  program,
  programs,
  slots,
  selection,
  selected,
}: {
  program: string;
  programs: string[];
  slots: Slot[];
  selection: {
    quota: string;
    specialty: string;
    hospital: string;
    capacity: number;
    cutoff: number | null;
    rows: Row[];
  } | null;
  selected: { quota: string; specialty: string; hospital: string };
}) {
  const { go, pending } = useFilterNav();
  const { ref: icon, handlers } = useActionIcon();
  const manual = useManualCandidate();

  // Re-ranked with the reader's own entry when there is one. The server cannot
  // see `localStorage` while rendering, so the page arrives without them and
  // this fills it in — the original includes the manual candidate in exactly
  // this view.
  const [withManual, setWithManual] = useState<{
    rows: Row[];
    capacity: number;
    cutoff: number | null;
  } | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    if (!manual?.preferences.length || !selection) {
      setWithManual(null);
      return;
    }
    let live = true;
    setRecomputing(true);
    slotWithManual(
      program,
      selection.quota,
      selection.specialty,
      selection.hospital,
      manual,
    )
      .then((result) => {
        if (!live || !result.ok) return;
        setWithManual({
          rows: result.rows,
          capacity: result.capacity,
          cutoff: result.cutoff,
        });
      })
      .finally(() => live && setRecomputing(false));
    return () => {
      live = false;
    };
  }, [manual, program, selection]);

  // Server-rendered rows unless a manual entry replaced them.
  const activeRows = withManual?.rows ?? selection?.rows ?? [];
  const activeCutoff = withManual?.cutoff ?? selection?.cutoff ?? null;

  const [quota, setQuota] = useState(selected.quota);
  const [specialty, setSpecialty] = useState(selected.specialty);
  const [hospital, setHospital] = useState(selected.hospital);

  const quotas = useMemo(
    () =>
      [...new Set(slots.map((s) => s.quota))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [slots],
  );

  const specialties = useMemo(
    () =>
      [
        ...new Set(
          slots
            .filter((s) => !quota || s.quota === quota)
            .map((s) => s.specialty),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [slots, quota],
  );

  const hospitals = useMemo(
    () =>
      [
        ...new Set(
          slots
            .filter(
              (s) =>
                (!quota || s.quota === quota) &&
                (!specialty || s.specialty === specialty),
            )
            .map((s) => s.hospital),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [slots, quota, specialty],
  );

  const complete = Boolean(quota && specialty && hospital);

  function load() {
    if (!complete) return;
    const next = new URLSearchParams({ program, quota, specialty, hospital });
    go(`/app/portal/slots?${next.toString()}`);
  }

  return (
    <>
      <Bezel className="mt-12" innerClassName="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end"
        >
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="slot-program">Programme</FieldLabel>
            <Select
              id="slot-program"
              value={program}
              onChange={(e) =>
                go(
                  `/app/portal/slots?program=${encodeURIComponent(e.target.value)}`,
                )
              }
            >
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="slot-quota">Quota</FieldLabel>
            <Select
              id="slot-quota"
              value={quota}
              onChange={(e) => {
                setQuota(e.target.value);
                // Downstream choices may not exist under the new quota.
                setSpecialty("");
                setHospital("");
              }}
            >
              <option value="">Select quota</option>
              {quotas.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="slot-specialty">Specialty</FieldLabel>
            <Select
              id="slot-specialty"
              value={specialty}
              disabled={!quota}
              onChange={(e) => {
                setSpecialty(e.target.value);
                setHospital("");
              }}
            >
              <option value="">Select specialty</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="slot-hospital">Hospital</FieldLabel>
            <Select
              id="slot-hospital"
              value={hospital}
              disabled={!specialty}
              onChange={(e) => setHospital(e.target.value)}
            >
              <option value="">Select hospital</option>
              {hospitals.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>

          <button
            type="submit"
            disabled={pending || !complete}
            {...handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Loading…" : "Show seat"}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <Search01Icon ref={icon} size={ICON_SIZE_SM} />
            </span>
          </button>
        </form>
      </Bezel>

      {/* Dimmed rather than blanked while the next seat loads: what is on
          screen is still the true answer for the seat that produced it. */}
      <FilterPending pending={pending}>
        {!selection ? (
          <Bezel className="mt-6" innerClassName="px-8 py-20 text-center">
            <TargetIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              No seat selected
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              Choose a quota, specialty and hospital above to see who applied
              and where the cutoff falls.
            </p>
          </Bezel>
        ) : (
          <>
            <Bezel className="mt-6" innerClassName="p-5">
              {manual?.preferences.length ? (
                <p className="mb-3 font-mono text-[11px] text-fg-subtle">
                  {recomputing ? (
                    "Re-ranking with your manual entry…"
                  ) : withManual ? (
                    <span className="font-bold text-hope">
                      Ranked including your manual entry.
                    </span>
                  ) : null}
                </p>
              ) : null}

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <SpecialtyLabel
                    specialty={selection.specialty}
                    className="text-base"
                  />
                  <p className="mt-1 text-sm leading-snug text-fg-muted">
                    {selection.hospital}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                    {program} · {selection.quota}
                  </p>
                </div>

                <div className="flex gap-6">
                  <Figure label="Seats" value={String(selection.capacity)} />
                  <Figure
                    label="Applied"
                    value={activeRows.length.toLocaleString("en-GB")}
                  />
                  <Figure
                    label="Cutoff"
                    value={activeCutoff != null ? activeCutoff.toFixed(2) : "—"}
                    tone={
                      activeCutoff != null ? "text-accent" : "text-fg-subtle"
                    }
                    hint={
                      activeCutoff == null ? "seat did not fill" : undefined
                    }
                  />
                </div>
              </div>
            </Bezel>

            <div className="mt-4 rounded-lg bg-surface-sunken/70 p-1 shadow-ambient ring-1 ring-border">
              <div className="overflow-x-auto rounded-[0.25rem] bg-surface shadow-[inset_0_1px_0_var(--edge-highlight)]">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    Everyone who applied for {selection.specialty} at{" "}
                    {selection.hospital}, ranked by the mark that applies to
                    this seat.
                  </caption>
                  <thead className="bg-surface-sunken">
                    <tr className="border-b border-border">
                      {["#", "Applicant", "Pref", "Mark", "Outcome"].map(
                        (label, i) => (
                          <th
                            key={label}
                            scope="col"
                            className={`px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted ${
                              i >= 2 ? "text-right" : "text-left"
                            }`}
                          >
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {activeRows.map((row, i) => (
                      <tr
                        key={`${row.applicantId}-${row.preferenceNo}`}
                        className={`border-b border-border/60 ${
                          row.applicantId === MANUAL_ID_BASE
                            ? "bg-hope/10 ring-1 ring-inset ring-hope/40"
                            : ""
                        } ${
                          // Faded: the simulation places them somewhere they
                          // ranked higher, so they are not really competing here
                          // and counting them as competition overstates it.
                          row.placedHigher ? "opacity-45" : ""
                        } ${row.selected ? "bg-status-safe/[0.06]" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs tabular-nums text-fg-subtle">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 text-[13px]">
                          {row.applicantId === MANUAL_ID_BASE ? (
                            <span className="font-bold text-hope">
                              {row.name ?? "Your entry"}
                              <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider">
                                you
                              </span>
                            </span>
                          ) : row.name ? (
                            <span className="font-bold text-foreground">
                              {row.name}
                            </span>
                          ) : (
                            <span
                              className="font-mono text-xs text-fg-muted"
                              title="Not named in any published merit list"
                            >
                              #{row.applicantId}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg-muted">
                          {row.preferenceNo}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                          {row.mark.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.selected ? (
                            <Tag tone="border-status-safe/50 text-status-safe">
                              Selected
                            </Tag>
                          ) : row.placedHigher ? (
                            <Tag tone="border-border-strong text-fg-subtle">
                              Placed higher
                            </Tag>
                          ) : (
                            <Tag tone="border-status-reach/50 text-status-reach">
                              Competing
                            </Tag>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </FilterPending>
    </>
  );
}

function Figure({
  label,
  value,
  tone = "text-foreground",
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${tone}`}>
        {value}
      </p>
      {hint && <p className="font-mono text-[9px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={`inline-flex w-[6.5rem] items-center justify-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {children}
    </span>
  );
}
