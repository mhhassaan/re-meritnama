"use client";

import { useFilterNav } from "@/components/app/use-filter-nav";
import { useState } from "react";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, Select, SearchField } from "@/components/app/field";
import { FilterIcon } from "@/components/ui/filter";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The Competition filters — the original's four: programme, quota, search,
 * sort. Applied on submit, like every other filter set in the portal.
 */
export function CompetitionControls({
  facets,
  selected,
}: {
  facets: { programs: string[]; quotas: string[] };
  selected: { program: string; quota: string; search: string; sort: string };
}) {
  const { go, pending } = useFilterNav();
  const { ref: icon, handlers } = useActionIcon();

  const [program, setProgram] = useState(selected.program);
  const [quota, setQuota] = useState(selected.quota);
  const [search, setSearch] = useState(selected.search);
  const [sort, setSort] = useState(selected.sort);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (program) next.set("program", program);
    if (quota) next.set("quota", quota);
    if (search.trim()) next.set("q", search.trim());
    if (sort && sort !== "ratio-desc") next.set("sort", sort);
    const query = next.toString();
    go(`/app/portal/competition${query ? `?${query}` : ""}`);
  }

  return (
    <Bezel className="mt-8" innerClassName="p-5">
      <form onSubmit={apply} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="comp-program">Programme</FieldLabel>
          <Select id="comp-program" value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">All programmes</option>
            {facets.programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="comp-quota">Quota</FieldLabel>
          <Select id="comp-quota" value={quota} onChange={(e) => setQuota(e.target.value)}>
            <option value="">All quotas</option>
            {facets.quotas.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1 xl:col-span-2">
          <FieldLabel htmlFor="comp-search">Search</FieldLabel>
          <SearchField
            id="comp-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Specialty…"
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="comp-sort">Sort</FieldLabel>
          <Select id="comp-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="ratio-desc">Highest competition</option>
            <option value="ratio-asc">Lowest competition</option>
            <option value="specialty">Specialty A–Z</option>
            <option value="applicants-desc">Most applicants</option>
          </Select>
        </div>

        <button
          type="submit"
          disabled={pending}
          {...handlers}
          className="group flex min-h-[46px] items-center gap-3 self-end rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] xl:col-start-5"
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
