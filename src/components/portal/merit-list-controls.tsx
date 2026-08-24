"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { FilterIcon } from "@/components/ui/filter";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The Merit List filters.
 *
 * State lives in the URL. Every filter narrows a server-rendered set, so a
 * change is a navigation whatever happens — and a URL that reproduces the view
 * is worth having when someone wants to send "look at this seat" to a
 * colleague.
 *
 * Every control, round included, is applied on submit. An earlier version
 * navigated the moment the round changed, on the theory that picking a snapshot
 * is a different act from narrowing one — but the form has an Apply button, and
 * a control that fires while its neighbours wait is the page behaving
 * inconsistently rather than helpfully. One button, one moment where anything
 * happens.
 */
export function MeritListControls({
  round,
  rounds,
  facets,
  selected,
}: {
  round: number;
  rounds: number[];
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
    consent: string;
    search: string;
  };
}) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [pendingRound, setPendingRound] = useState(String(round));
  const [program, setProgram] = useState(selected.program);
  const [specialty, setSpecialty] = useState(selected.specialty);
  const [hospital, setHospital] = useState(selected.hospital);
  const [quota, setQuota] = useState(selected.quota);
  const [consent, setConsent] = useState(selected.consent);
  const [search, setSearch] = useState(selected.search);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    next.set("round", pendingRound);
    if (program) next.set("program", program);
    if (specialty) next.set("specialty", specialty);
    if (hospital) next.set("hospital", hospital);
    if (quota) next.set("quota", quota);
    if (consent) next.set("consent", consent);
    if (search.trim()) next.set("q", search.trim());
    router.push(`/app/portal/merit-list?${next.toString()}`);
  }

  return (
    <Bezel innerClassName="p-5">
      <form onSubmit={apply} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-round">Round</FieldLabel>
          <Select
            id="ml-round"
            value={pendingRound}
            onChange={(e) => setPendingRound(e.target.value)}
          >
            {rounds.map((r) => (
              <option key={r} value={String(r)}>
                Round {r}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-program">Programme</FieldLabel>
          <Select
            id="ml-program"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          >
            <option value="">All programmes</option>
            {facets.programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-specialty">Specialty</FieldLabel>
          <Select
            id="ml-specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="">All specialties</option>
            {facets.specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-hospital">Hospital</FieldLabel>
          <Select
            id="ml-hospital"
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

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-quota">Quota</FieldLabel>
          <Select id="ml-quota" value={quota} onChange={(e) => setQuota(e.target.value)}>
            <option value="">All quotas</option>
            {facets.quotas.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-consent">Consent</FieldLabel>
          <Select
            id="ml-consent"
            value={consent}
            onChange={(e) => setConsent(e.target.value)}
          >
            <option value="">All</option>
            <option value="Accepted">Accepted</option>
            <option value="Excluded">Excluded</option>
            <option value="Awaited">Awaited</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ml-search">Search</FieldLabel>
          <SearchField
            id="ml-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, PMDC or ID…"
          />
        </div>

        <button
          type="submit"
          {...handlers}
          className="group flex min-h-[46px] items-center gap-3 self-end rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
        >
          Apply filters
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
            <FilterIcon ref={icon} size={ICON_SIZE_SM} />
          </span>
        </button>
      </form>
    </Bezel>
  );
}
