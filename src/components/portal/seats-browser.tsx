"use client";

import { useMemo, useState } from "react";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { TableIcon } from "@/components/icons/koboyo";

type Seat = {
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  institute: string | null;
  seats: number;
};

/**
 * The seat table.
 *
 * Filtering is client-side: 873 rows are already in the payload, they carry no
 * personal data, and a round trip per keystroke would be slower for nothing.
 *
 * Grouped by specialty rather than listed flat. A candidate arrives asking
 * "where can I do Cardiology", not "show me 873 rows", and the totals per
 * specialty are the number that actually answers it.
 */
export function SeatsBrowser({ seats }: { seats: Seat[] }) {
  const [program, setProgram] = useState("");
  const [quota, setQuota] = useState("");
  const [search, setSearch] = useState("");

  const programs = useMemo(
    () => [...new Set(seats.map((s) => s.program))].sort((a, b) => a.localeCompare(b)),
    [seats]
  );
  const quotas = useMemo(
    () => [...new Set(seats.map((s) => s.quota))].sort((a, b) => a.localeCompare(b)),
    [seats]
  );

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();

    const visible = seats.filter((seat) => {
      if (program && seat.program !== program) return false;
      if (quota && seat.quota !== quota) return false;
      if (!term) return true;
      return (
        seat.specialty.toLowerCase().includes(term) ||
        seat.hospital.toLowerCase().includes(term)
      );
    });

    const bySpecialty = new Map<string, Seat[]>();
    for (const seat of visible) {
      const list = bySpecialty.get(seat.specialty);
      if (list) list.push(seat);
      else bySpecialty.set(seat.specialty, [seat]);
    }

    return [...bySpecialty.entries()]
      .map(([specialty, rows]) => ({
        specialty,
        rows: rows.sort(
          (a, b) => b.seats - a.seats || a.hospital.localeCompare(b.hospital)
        ),
        total: rows.reduce((sum, r) => sum + r.seats, 0),
      }))
      // Biggest specialty first: it is the one most people are competing in.
      .sort((a, b) => b.total - a.total || a.specialty.localeCompare(b.specialty));
  }, [seats, program, quota, search]);

  const shown = groups.reduce((sum, g) => sum + g.total, 0);

  return (
    <>
      <Bezel className="mt-6" innerClassName="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="seats-program">Programme</FieldLabel>
            <Select
              id="seats-program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
            >
              <option value="">All programmes</option>
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="seats-quota">Quota</FieldLabel>
            <Select id="seats-quota" value={quota} onChange={(e) => setQuota(e.target.value)}>
              <option value="">All quotas</option>
              {quotas.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-px bg-border">
            <FieldLabel htmlFor="seats-search">Search</FieldLabel>
            <SearchField
              id="seats-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Specialty or hospital…"
            />
          </div>
        </div>
      </Bezel>

      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">{shown.toLocaleString("en-GB")}</span>{" "}
        seats across {groups.length.toLocaleString("en-GB")}{" "}
        {groups.length === 1 ? "specialty" : "specialties"}
      </p>

      {groups.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
          <TableIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            No seats match
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Try a different programme or quota, or clear the search.
          </p>
        </Bezel>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.specialty} className="bg-background p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
                <SpecialtyLabel specialty={group.specialty} className="text-sm" />
                <span className="font-mono text-xs tabular-nums text-fg-muted">
                  <span className="font-bold text-foreground">
                    {group.total.toLocaleString("en-GB")}
                  </span>{" "}
                  {group.total === 1 ? "seat" : "seats"} ·{" "}
                  {group.rows.length} {group.rows.length === 1 ? "slot" : "slots"}
                </span>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5">
                {group.rows.map((seat) => (
                  <li
                    key={`${seat.program}|${seat.quota}|${seat.hospital}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {seat.hospital}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                      {seat.program} · {seat.quota}
                    </span>
                    <span className="w-10 text-right font-mono text-xs font-bold tabular-nums text-accent">
                      {seat.seats}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
