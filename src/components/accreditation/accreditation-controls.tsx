"use client";

import { useFilterNav } from "@/components/app/use-filter-nav";
import { useState } from "react";
import type { AccreditationFacets } from "@/lib/accreditation/data";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { FilterIcon } from "@/components/ui/filter";
import { RedoIcon } from "@/components/ui/redo";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The four controls the original has, in its order: hospital search, city,
 * speciality, accreditation type, plus its Reset.
 *
 * URL state rather than component state, because a filtered view here is worth
 * sending to somebody — "Cardiology in Lahore" is the shape of the question
 * people actually ask each other, and the original's version cannot be linked
 * to at all.
 */
export function AccreditationControls({
  facets,
  selected,
}: {
  facets: AccreditationFacets;
  selected: { search: string; city: string; speciality: string; type: string };
}) {
  const { go, pending } = useFilterNav();
  const { ref: filterIcon, handlers: filterHandlers } = useActionIcon();
  const { ref: resetIcon, handlers: resetHandlers } = useActionIcon();

  const [search, setSearch] = useState(selected.search);
  const [city, setCity] = useState(selected.city);
  const [speciality, setSpeciality] = useState(selected.speciality);
  const [type, setType] = useState(selected.type);

  const dirty = Boolean(search || city || speciality || type);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (city) next.set("city", city);
    if (speciality) next.set("speciality", speciality);
    if (type) next.set("type", type);
    const query = next.toString();
    go(`/app/accreditation${query ? `?${query}` : ""}`);
  }

  function reset() {
    setSearch("");
    setCity("");
    setSpeciality("");
    setType("");
    go("/app/accreditation");
  }

  return (
    <Bezel className="mt-8" innerClassName="p-5">
      <form onSubmit={apply} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ac-search">Hospital / institute</FieldLabel>
          <SearchField
            id="ac-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hospital…"
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ac-city">City</FieldLabel>
          <Select id="ac-city" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {facets.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ac-spec">Speciality</FieldLabel>
          <Select
            id="ac-spec"
            value={speciality}
            onChange={(e) => setSpeciality(e.target.value)}
          >
            <option value="">All specialities</option>
            {facets.specialities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="ac-type">Accreditation type</FieldLabel>
          <Select id="ac-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {facets.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={pending}
            {...filterHandlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
          >
            {pending ? "Updating…" : "Apply filters"}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <FilterIcon ref={filterIcon} size={ICON_SIZE_SM} aria-hidden />
            </span>
          </button>

          {dirty && (
            <button
              type="button"
              onClick={reset}
              {...resetHandlers}
              className="flex min-h-[46px] items-center gap-2.5 rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
            >
              <RedoIcon ref={resetIcon} size={ICON_SIZE_SM} aria-hidden />
              Reset
            </button>
          )}
        </div>
      </form>
    </Bezel>
  );
}
