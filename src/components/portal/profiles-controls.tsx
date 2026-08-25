"use client";

import { useFilterNav } from "@/components/app/use-filter-nav";
import { useState } from "react";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { FilterIcon } from "@/components/ui/filter";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * Search and specialty filter for Community Profiles.
 *
 * The original filters by status (All / Inducted / Applicant). We have no
 * inducted flag on a profile — it is derived from the joining export, which
 * this page is not allowed to read — so specialty takes its place, which is
 * the field people are actually looking each other up by.
 */
export function ProfilesControls({
  specialties,
  selected,
}: {
  specialties: string[];
  selected: { search: string; specialty: string };
}) {
  const { go, pending } = useFilterNav();
  const { ref: icon, handlers } = useActionIcon();

  const [search, setSearch] = useState(selected.search);
  const [specialty, setSpecialty] = useState(selected.specialty);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (specialty) next.set("specialty", specialty);
    // Page is dropped: narrowing should start at the top of the new result,
    // not on page 4 of a list that may now be one page long.
    const query = next.toString();
    go(`/app/portal/profiles${query ? `?${query}` : ""}`);
  }

  return (
    <Bezel className="mt-8" innerClassName="p-5">
      <form onSubmit={apply} className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="pf-search">Search</FieldLabel>
          <SearchField
            id="pf-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, specialty or hospital…"
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="pf-specialty">Aspiring specialty</FieldLabel>
          <Select
            id="pf-specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="">All specialties</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
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
