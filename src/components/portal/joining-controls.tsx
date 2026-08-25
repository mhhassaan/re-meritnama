"use client";

import { useFilterNav } from "@/components/app/use-filter-nav";
import { useState } from "react";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { FilterIcon } from "@/components/ui/filter";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The Joining Status filters — the original's six: programme, specialty,
 * hospital, quota, search and join status.
 *
 * Every control is applied on submit, including the selects. The Merit List
 * settled this: a form with an Apply button where one control fires on change
 * is the page behaving inconsistently rather than helpfully.
 */
export function JoiningControls({
  facets,
  selected,
}: {
  facets: {
    programs: string[];
    specialties: string[];
    hospitals: string[];
    quotas: string[];
  };
  selected: {
    program: string;
    specialty: string;
    hospital: string;
    quota: string;
    search: string;
    status: string;
  };
}) {
  const { go, pending } = useFilterNav();
  const { ref: icon, handlers } = useActionIcon();

  const [program, setProgram] = useState(selected.program);
  const [specialty, setSpecialty] = useState(selected.specialty);
  const [hospital, setHospital] = useState(selected.hospital);
  const [quota, setQuota] = useState(selected.quota);
  const [search, setSearch] = useState(selected.search);
  const [status, setStatus] = useState(selected.status);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (program) next.set("program", program);
    if (specialty) next.set("specialty", specialty);
    if (hospital) next.set("hospital", hospital);
    if (quota) next.set("quota", quota);
    if (search.trim()) next.set("q", search.trim());
    if (status) next.set("status", status);
    const query = next.toString();
    go(`/app/portal/joining${query ? `?${query}` : ""}`);
  }

  return (
    <Bezel className="mt-8" innerClassName="p-5">
      <form onSubmit={apply} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Programme" id="j-program" value={program} onChange={setProgram}>
          <option value="">All programmes</option>
          {facets.programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Field>

        <Field
          label="Specialty"
          id="j-specialty"
          value={specialty}
          onChange={setSpecialty}
        >
          <option value="">All specialties</option>
          {facets.specialties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Field>

        <Field label="Hospital" id="j-hospital" value={hospital} onChange={setHospital}>
          <option value="">All hospitals</option>
          {facets.hospitals.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Field>

        <Field label="Quota" id="j-quota" value={quota} onChange={setQuota}>
          <option value="">All quotas</option>
          {facets.quotas.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </Field>

        <Field label="Join status" id="j-status" value={status} onChange={setStatus}>
          <option value="">All</option>
          <option value="joined">Has someone joined</option>
          <option value="pending">Someone has not joined</option>
        </Field>

        <div className="flex flex-col gap-1 xl:col-span-2">
          <FieldLabel htmlFor="j-search">Search</FieldLabel>
          <SearchField
            id="j-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or applicant ID…"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          {...handlers}
          className="group flex min-h-[46px] items-center gap-3 self-end rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
        >
          {pending ? "Updating…" : "Apply filters"}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
            <FilterIcon ref={icon} size={ICON_SIZE_SM} />
          </span>
        </button>
      </form>
    </Bezel>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  children,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </div>
  );
}
