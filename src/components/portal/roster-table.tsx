"use client";

import { useState, useTransition } from "react";
import { useFilterNav } from "@/components/app/use-filter-nav";
import type { RosterRow, RosterView } from "@/lib/portal/directory";
import type { DirectoryRecord } from "@/lib/portal/directory";
import { fetchDirectoryRecord } from "@/lib/portal/directory-action";
import { DirectoryRecordModal } from "@/components/portal/directory-record-modal";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { Pill } from "@/components/portal/portal-terms";
import { FilterIcon } from "@/components/ui/filter";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";
import { useIdentifiedApplicant } from "@/components/portal/find-me-bar";

/**
 * The Candidate Pool roster — the original's table.
 *
 * Columns are the original's: `# · Name ✎ · Official · Applied · [View]`.
 * Clicking a row opens that person's record.
 *
 * ## Everything that narrows the list is a navigation
 *
 * Search, programme, status, sort and page all live in the URL and are applied
 * **in the database**. Not because URL state is tidier, but because a
 * client-side filter would require the whole pool in the payload, and no
 * request here is allowed to return the whole pool. That is the difference
 * between a roster and a dump, and it has to be a property of the query rather
 * than of this component behaving well.
 *
 * ## The record is fetched, not carried
 *
 * A page of 50 rows carries 50 names and marks. It does not carry 50 preference
 * lists — those run to 358 entries each. The record arrives from a server
 * action when a row is actually opened.
 */

const STATUS: Record<number, { label: string; tone: "safe" | "reach" | "danger" }> = {
  1: { label: "Accepted", tone: "safe" },
  2: { label: "Rejected", tone: "danger" },
  11: { label: "Pending", tone: "reach" },
};

export function RosterTable({
  view,
  programs,
  selected,
}: {
  view: RosterView;
  programs: string[];
  selected: { search: string; program: string; status: string; sort: string };
}) {
  const { go, pending } = useFilterNav();
  const me = useIdentifiedApplicant();
  const { ref: icon, handlers } = useActionIcon();

  const [search, setSearch] = useState(selected.search);
  const [program, setProgram] = useState(selected.program);
  const [status, setStatus] = useState(selected.status);
  const [sort, setSort] = useState(selected.sort || "marks");

  const [open, setOpen] = useState<number | null>(null);
  const [record, setRecord] = useState<DirectoryRecord | null>(null);
  // Separate from the filter transition the hook owns: this one is about
  // fetching one candidate's record for the modal, and the two can overlap.
  const [loadingRecord, startLoadingRecord] = useTransition();

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (program) next.set("program", program);
    if (status) next.set("status", status);
    if (sort && sort !== "marks") next.set("sort", sort);
    // Page is deliberately dropped: narrowing a list should start at its top,
    // not on page 12 of a result that may now have three pages.
    go(`/app/portal/pool?${next.toString()}`);
  }

  function openRecord(applicantId: number) {
    setOpen(applicantId);
    setRecord(null);
    startLoadingRecord(async () => {
      const found = await fetchDirectoryRecord(applicantId);
      setRecord(found);
    });
  }

  function goToPage(page: number) {
    const next = new URLSearchParams();
    if (selected.search) next.set("q", selected.search);
    if (selected.program) next.set("program", selected.program);
    if (selected.status) next.set("status", selected.status);
    if (selected.sort && selected.sort !== "marks") next.set("sort", selected.sort);
    if (page > 1) next.set("page", String(page));
    // Pagination is the one navigation here that SHOULD scroll: arriving at
    // page 4 still parked at the bottom of page 3 shows the reader the end of a
    // list they have not seen the start of.
    go(`/app/portal/pool?${next.toString()}`, { scroll: true });
  }

  const from = (view.page - 1) * view.pageSize;

  return (
    <>
      <Bezel className="mt-5" innerClassName="p-5">
        <form onSubmit={apply} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <div className="flex flex-col gap-1 xl:col-span-2">
            <FieldLabel htmlFor="roster-search">Search</FieldLabel>
            <SearchField
              id="roster-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, PMDC or applicant ID…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="roster-program">Programme</FieldLabel>
            <Select
              id="roster-program"
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
            <FieldLabel htmlFor="roster-status">Verification</FieldLabel>
            <Select
              id="roster-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="1">Accepted</option>
              <option value="11">Pending</option>
              <option value="2">Rejected</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="roster-sort">Sort</FieldLabel>
            <Select id="roster-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="marks">Marks, highest first</option>
              <option value="name">Name</option>
              <option value="id">Applicant ID</option>
            </Select>
          </div>

          <button
            type="submit"
            {...handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] xl:col-start-5"
          >
            Apply filters
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <FilterIcon ref={icon} size={ICON_SIZE_SM} />
            </span>
          </button>
        </form>
      </Bezel>

      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">
          {view.total.toLocaleString("en-GB")}
        </span>{" "}
        {view.total === 1 ? "applicant" : "applicants"}
        {view.pageCount > 1 && (
          <>
            {" · showing "}
            {(from + 1).toLocaleString("en-GB")}&ndash;
            {(from + view.rows.length).toLocaleString("en-GB")} (page {view.page} of{" "}
            {view.pageCount})
          </>
        )}
      </p>

      {view.rows.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-16 text-center">
          <p className="font-sans text-base font-bold text-foreground">
            Nobody matches
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Try a different programme or verification status, or clear the
            search.
          </p>
        </Bezel>
      ) : (
        <Bezel className="mt-3" innerClassName="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <Th className="w-14">#</Th>
                <Th>Name</Th>
                <Th className="w-28 text-right">Official</Th>
                <Th className="w-32">Verification</Th>
                <Th>Applied</Th>
                <Th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row, i) => (
                <Row
                  key={row.applicantId}
                  row={row}
                  index={from + i + 1}
                  isMe={row.applicantId === me}
                  onOpen={() => openRecord(row.applicantId)}
                />
              ))}
            </tbody>
          </table>
        </Bezel>
      )}

      {view.pageCount > 1 && (
        <nav
          aria-label="Roster pages"
          className="mt-6 flex flex-wrap items-center justify-center gap-1.5"
        >
          <Step disabled={view.page === 1} onClick={() => goToPage(view.page - 1)}>
            Previous
          </Step>
          <span className="px-3 font-mono text-[11px] tabular-nums text-fg-muted">
            {view.page} / {view.pageCount}
          </span>
          <Step
            disabled={view.page === view.pageCount}
            onClick={() => goToPage(view.page + 1)}
          >
            Next
          </Step>
        </nav>
      )}

      {open != null && (
        <DirectoryRecordModal
          record={record}
          loading={loadingRecord}
          onClose={() => {
            setOpen(null);
            setRecord(null);
          }}
        />
      )}
    </>
  );
}

function Row({
  row,
  index,
  isMe,
  onOpen,
}: {
  row: RosterRow;
  index: number;
  isMe: boolean;
  onOpen: () => void;
}) {
  const status = row.profileStatus != null ? STATUS[row.profileStatus] : undefined;

  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-sunken ${
        isMe ? "bg-hope/10" : ""
      }`}
    >
      <Td className="font-mono text-[10px] tabular-nums text-fg-subtle">{index}</Td>

      <Td>
        <span className="font-bold text-foreground">
          {row.name ?? `Applicant ${row.applicantId}`}
        </span>
        {row.amended && (
          <span
            title="This record carries an amendment"
            className="ml-1.5 font-mono text-[10px] text-status-reach"
          >
            ✎
          </span>
        )}
        {isMe && (
          <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-hope">
            you
          </span>
        )}
        <span className="ml-2 font-mono text-[10px] tabular-nums text-fg-subtle">
          {row.applicantId}
        </span>
      </Td>

      <Td className="text-right font-mono text-xs font-bold tabular-nums text-accent">
        {row.marksTotal != null ? row.marksTotal.toFixed(2) : "—"}
      </Td>

      <Td>
        {status ? (
          <Pill tone={status.tone}>{status.label}</Pill>
        ) : (
          <span className="font-mono text-[10px] text-fg-subtle">No record</span>
        )}
      </Td>

      <Td>
        <span className="flex flex-wrap gap-1">
          {row.appliedIn.length === 0 ? (
            <span className="font-mono text-[10px] text-fg-subtle">—</span>
          ) : (
            row.appliedIn.map((program) => (
              <Pill key={program} tone="accent">
                {program}
              </Pill>
            ))
          )}
        </span>
      </Td>

      <Td className="text-right">
        {/* A real button as well as the row click: the row is convenient, and
            this is the thing a keyboard reaches. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="rounded-sm border border-border-strong px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
        >
          View
        </button>
      </Td>
    </tr>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-fg-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 text-[13px] ${className}`}>{children}</td>;
}

function Step({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const className =
    "rounded-sm border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors";

  if (disabled) {
    return (
      <span className={`${className} border-border text-fg-subtle opacity-50`}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} border-border-strong text-fg-muted hover:border-accent hover:text-foreground`}
    >
      {children}
    </button>
  );
}
