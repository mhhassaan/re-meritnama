"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MeritListCycle } from "@/lib/merit-lists/data";
import {
  FieldLabel,
  SearchField,
  Select,
} from "@/components/app/field";
import { FilterIcon } from "@/components/ui/filter";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The cycle / round / programme / quota picker.
 *
 * State lives in the URL rather than in the component. The list is
 * candidate-level data fetched on the server under RLS, so it has to be a
 * server render anyway — and a URL that reproduces the view is shareable and
 * survives the back button, which a local `useState` would not be.
 */
export function MeritListControls({
  cycles,
  programs,
  quotas,
}: {
  cycles: MeritListCycle[];
  programs: string[];
  quotas: string[];
}) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();
  const params = useSearchParams();

  const [induction, setInduction] = useState(params.get("induction") ?? "");
  const [round, setRound] = useState(params.get("round") ?? "");
  const [program, setProgram] = useState(params.get("program") ?? "");
  const [quota, setQuota] = useState(params.get("quota") ?? "");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const selected = cycles.find((c) => String(c.induction) === induction);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!induction || !round) return;

    const next = new URLSearchParams();
    next.set("induction", induction);
    next.set("round", round);
    if (program) next.set("program", program);
    if (quota) next.set("quota", quota);
    if (search.trim()) next.set("q", search.trim());

    router.push(`/app/merit-lists?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="ml-induction">Induction cycle</FieldLabel>
        <Select
          id="ml-induction"
          value={induction}
          onChange={(e) => {
            setInduction(e.target.value);
            // The round list is per cycle, so a stale round would submit a
            // combination that has no data.
            setRound("");
          }}
        >
          <option value="">Select cycle</option>
          {cycles.map((c) => (
            <option key={c.induction} value={String(c.induction)}>
              {/* Year AND induction here: two cycles ran in 2026, and a
                  selector offering "2026" twice is unusable. The original
                  writes it out the same way. */}
              {c.labelWithInduction}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="ml-round">Round</FieldLabel>
        <Select
          id="ml-round"
          value={round}
          onChange={(e) => setRound(e.target.value)}
          disabled={!selected}
        >
          <option value="">Select round</option>
          {selected?.rounds.map((r) => (
            <option key={r} value={String(r)}>
              Round {r}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="ml-program">Program</FieldLabel>
        <Select
          id="ml-program"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="ml-quota">Quota</FieldLabel>
        <Select
          id="ml-quota"
          value={quota}
          onChange={(e) => setQuota(e.target.value)}
        >
          <option value="">All quotas</option>
          {quotas.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
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
        disabled={!induction || !round}
        {...handlers}
        className="group flex min-h-[46px] items-center gap-3 self-end rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Load
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
          <FilterIcon ref={icon} size={ICON_SIZE_SM} />
        </span>
      </button>
    </form>
  );
}
