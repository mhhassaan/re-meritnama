"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FieldLabel, NumberField, Select } from "@/components/app/field";
import {
  clear as clearManual,
  load as loadManual,
  save as saveManual,
  validate,
  type ManualCandidate,
  type ManualPreference,
} from "@/lib/portal/manual-candidate";
import { AlertIcon } from "@/components/icons/koboyo";

/**
 * Add me manually.
 *
 * For a candidate who is not in any published round and therefore cannot be
 * found in the portal at all. They enter their marks and preference list, and
 * the simulation treats them as a competitor.
 *
 * ## Why it is a portal, literally
 *
 * `<Reveal>` carries a transform, which makes it the containing block for any
 * `position: fixed` descendant — a modal rendered inside one anchors to the
 * wrapper rather than the viewport. This is rendered through
 * `createPortal` into `document.body` so it cannot inherit that from wherever
 * it happens to be mounted. The same trap has already cost a mobile sheet on
 * the merit table.
 *
 * ## The preference editor
 *
 * Preferences are ORDERED — the whole algorithm is "walk your list in order" —
 * so the editor is a list with move up and down, not a set of checkboxes. Each
 * row cascades programme to quota to specialty to hospital, built from the real
 * seat list, so it is impossible to enter a seat that does not exist.
 */

type SeatOption = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
};

const BLANK: ManualPreference = {
  preference_no: 1,
  program: "",
  quota: "",
  specialty: "",
  hospital: "",
};

export function AddMeModal({
  seats,
  open,
  onClose,
}: {
  seats: SeatOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [marks, setMarks] = useState("");
  const [rows, setRows] = useState<ManualPreference[]>([BLANK]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);

  // Load whatever was saved each time the modal opens, so reopening shows the
  // list as it stands rather than a stale copy from the last mount.
  useEffect(() => {
    if (!open) return;
    const existing = loadManual();
    setName(existing?.name ?? "");
    setMarks(existing ? String(existing.marksTotal) : "");
    setRows(existing?.preferences.length ? existing.preferences : [BLANK]);
    setErrors([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, onClose]);

  const programs = useMemo(
    () => [...new Set(seats.map((s) => s.program))].sort((a, b) => a.localeCompare(b)),
    [seats]
  );

  const optionsFor = (row: ManualPreference) => {
    const inProgram = seats.filter((s) => s.program === row.program);
    const inQuota = inProgram.filter((s) => !row.quota || s.quota === row.quota);
    const inSpecialty = inQuota.filter(
      (s) => !row.specialty || s.specialty === row.specialty
    );
    const uniq = (values: string[]) =>
      [...new Set(values)].sort((a, b) => a.localeCompare(b));

    return {
      quotas: uniq(inProgram.map((s) => s.quota)),
      specialties: uniq(inQuota.map((s) => s.specialty)),
      hospitals: uniq(inSpecialty.map((s) => s.hospital)),
    };
  };

  function update(index: number, patch: Partial<ManualPreference>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Clearing downstream choices: a quota that does not exist under the
        // new programme would leave a row that silently matches no seat.
        if (patch.program !== undefined) {
          next.quota = "";
          next.specialty = "";
          next.hospital = "";
        } else if (patch.quota !== undefined) {
          next.specialty = "";
          next.hospital = "";
        } else if (patch.specialty !== undefined) {
          next.hospital = "";
        }
        return next;
      })
    );
  }

  function move(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validate({ name, marksTotal: marks, preferences: rows });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    saveManual(result.value);
    onClose();
  }

  function remove() {
    clearManual();
    onClose();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add me manually"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
    >
      <div className="w-full max-w-3xl rounded-lg bg-surface-sunken p-1 shadow-lifted ring-1 ring-border">
        <form
          onSubmit={submit}
          className="rounded-[0.25rem] bg-surface p-6 shadow-[inset_0_1px_0_var(--edge-highlight)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-sans text-lg font-black tracking-tight text-foreground">
                Add me manually
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                For candidates who do not appear in any published round. Your
                entry competes in the simulation.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="font-mono text-lg leading-none text-fg-subtle transition-colors hover:text-foreground"
            >
              ×
            </button>
          </div>

          {/* Said plainly and up front, not buried at the bottom. */}
          <p className="mt-4 flex items-start gap-2.5 rounded-sm bg-surface-sunken/70 p-3 text-xs leading-relaxed text-fg-muted">
            <AlertIcon className="mt-px h-3.5 w-auto shrink-0 text-status-reach" />
            <span>
              This stays in <strong className="text-foreground">this browser</strong>.
              It is never sent to us or saved to any account — only passed to the
              engine when you run a simulation, and nothing about it is verified,
              so treat the result as an illustration of where your marks would
              fall.
            </span>
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="manual-name">Name</FieldLabel>
              <input
                id="manual-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As you would like it shown"
                className="min-h-[46px] w-full rounded-sm border border-border-strong bg-surface-sunken px-3 text-sm text-foreground shadow-[inset_0_1px_2px_var(--field-inset)] transition-[border-color,box-shadow] duration-[250ms] placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="manual-marks">Aggregate marks</FieldLabel>
              <NumberField
                id="manual-marks"
                value={marks}
                step="0.01"
                onChange={(e) => setMarks(e.target.value)}
                placeholder="e.g. 22.45"
              />
            </div>
          </div>

          <div className="mt-6 flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Preferences, in order
            </p>
            <p className="font-mono text-[10px] text-fg-subtle">
              Preference 1 is your first choice
            </p>
          </div>

          <ol className="mt-3 flex flex-col gap-3">
            {rows.map((row, index) => {
              const options = optionsFor(row);
              return (
                <li
                  key={index}
                  className="rounded-sm border border-border bg-surface-sunken/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      Preference {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="Move down"
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        label="Remove preference"
                        disabled={rows.length === 1}
                        onClick={() =>
                          setRows((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        ×
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Select
                      aria-label="Programme"
                      value={row.program}
                      onChange={(e) => update(index, { program: e.target.value })}
                    >
                      <option value="">Programme</option>
                      {programs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>

                    <Select
                      aria-label="Quota"
                      value={row.quota}
                      disabled={!row.program}
                      onChange={(e) => update(index, { quota: e.target.value })}
                    >
                      <option value="">Quota</option>
                      {options.quotas.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </Select>

                    <Select
                      aria-label="Specialty"
                      value={row.specialty}
                      disabled={!row.quota}
                      onChange={(e) => update(index, { specialty: e.target.value })}
                    >
                      <option value="">Specialty</option>
                      {options.specialties.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>

                    <Select
                      aria-label="Hospital"
                      value={row.hospital}
                      disabled={!row.specialty}
                      onChange={(e) => update(index, { hospital: e.target.value })}
                    >
                      <option value="">Hospital</option>
                      {options.hospitals.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { ...BLANK }])}
            className="mt-3 flex min-h-[42px] items-center rounded-sm border border-border-strong px-4 text-sm font-bold text-foreground transition-colors hover:border-accent"
          >
            Add another preference
          </button>

          {errors.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1">
              {errors.map((error) => (
                <li key={error} className="text-xs leading-relaxed text-status-danger">
                  {error}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <button
              type="submit"
              className="flex min-h-[46px] items-center rounded-sm bg-accent-strong px-6 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
            >
              Save and compete
            </button>

            <button
              type="button"
              onClick={remove}
              className="flex min-h-[46px] items-center rounded-sm border border-border-strong px-4 text-sm font-bold text-fg-muted transition-colors hover:border-status-danger hover:text-status-danger"
            >
              Remove my entry
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-sm border border-border font-mono text-xs text-fg-muted transition-colors hover:border-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function useManualCandidate(): ManualCandidate | null {
  const [candidate, setCandidate] = useState<ManualCandidate | null>(null);

  useEffect(() => {
    const read = () => setCandidate(loadManual());
    read();
    window.addEventListener("storage", read);
    window.addEventListener("mn-manual-changed", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("mn-manual-changed", read);
    };
  }, []);

  return candidate;
}
