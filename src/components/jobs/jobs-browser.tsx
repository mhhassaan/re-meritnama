"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { JobWithStatus, JobsFacets } from "@/lib/jobs/data";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, SearchField, Select } from "@/components/app/field";
import { LoadMore } from "@/components/portal/load-more";
import { formatDate } from "@/lib/format/date";
import { ArchiveIcon } from "@/components/icons/koboyo";
import { ArrowUpRight01Icon } from "@/components/ui/arrow-up-right-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

const BATCH = 12;

/**
 * The job board.
 *
 * 75 postings with their vacancy lists is a few hundred kilobytes, so the whole
 * set is sent once and filtered in the browser — five filters and a free-text
 * search all running per keystroke, with only the markup deferred in batches.
 * The same arrangement as Seat Allocation and Data Changes.
 */
export function JobsBrowser({
  jobs,
  facets,
}: {
  jobs: JobWithStatus[];
  facets: JobsFacets;
}) {
  const [search, setSearch] = useState("");
  const [organization, setOrganization] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState("");
  // Deliberately not defaulted to "open". Every posting in the current snapshot
  // has closed, so an "open" default would open the page on an empty board and
  // read as the feature being broken rather than the data being old.
  const [status, setStatus] = useState("");
  const [shown, setShown] = useState(BATCH);
  const [open, setOpen] = useState<JobWithStatus | null>(null);

  // Compared during render rather than in an effect, which would paint one
  // frame of the previous filter's batch first.
  const signature = `${search}|${organization}|${city}|${role}|${status}`;
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setShown(BATCH);
  }

  const matched = useMemo(() => {
    const term = search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (organization && job.organization !== organization) return false;
      if (city && job.city !== city) return false;
      if (role && !job.vacancies.includes(role)) return false;
      if (status && job.status !== status) return false;
      if (term) {
        const hit =
          job.title.toLowerCase().includes(term) ||
          job.organization.toLowerCase().includes(term) ||
          job.location.toLowerCase().includes(term) ||
          job.vacancies.some((v) => v.toLowerCase().includes(term));
        if (!hit) return false;
      }
      return true;
    });
  }, [jobs, search, organization, city, role, status]);

  return (
    <>
      <Bezel className="mt-8" innerClassName="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1 lg:col-span-3">
            <FieldLabel htmlFor="jb-search">Search</FieldLabel>
            <SearchField
              id="jb-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, organization, location or role…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="jb-role">Role</FieldLabel>
            <Select id="jb-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {facets.roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="jb-org">Organization</FieldLabel>
            <Select
              id="jb-org"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            >
              <option value="">All organizations</option>
              {facets.organizations.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="jb-city">City</FieldLabel>
            <Select id="jb-city" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All cities</option>
              {facets.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="jb-status">Status</FieldLabel>
            <Select
              id="jb-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="open">Still open</option>
              <option value="closed">Closed</option>
              <option value="unknown">No deadline given</option>
            </Select>
          </div>
        </div>
      </Bezel>

      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">
          {matched.length.toLocaleString("en-GB")}
        </span>{" "}
        {matched.length === 1 ? "posting" : "postings"} match
        {matched.length !== jobs.length && (
          <span className="text-fg-subtle">
            {" "}
            · of {jobs.length.toLocaleString("en-GB")}
          </span>
        )}
      </p>

      {matched.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
          <ArchiveIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            No posting matches
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            {status === "open"
              ? "Nothing in this snapshot is still open — every deadline in it has passed. Clear the status filter to browse the archive."
              : "Try a different role, organization or city, or clear the search."}
          </p>
        </Bezel>
      ) : (
        <>
          <div className="mt-3 grid auto-rows-fr gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
            {matched.slice(0, shown).map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => setOpen(job)} />
            ))}
          </div>

          <LoadMore
            shown={Math.min(shown, matched.length)}
            total={matched.length}
            noun="postings"
            onClick={() => setShown((v) => v + BATCH)}
          />
        </>
      )}

      {open && <JobModal job={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * The status dot and label.
 *
 * Computed from the deadline, never from the source's `isOpen` flag — see
 * `@/lib/jobs/data`. A closed posting says how long ago it closed rather than
 * only that it did, because "closed 3 days ago" and "closed 7 weeks ago" are
 * different signals about whether the organization is still hiring.
 */
function StatusChip({ job }: { job: JobWithStatus }) {
  const tone =
    job.status === "open"
      ? "border-status-safe/40 bg-status-safe/10 text-status-safe"
      : job.status === "closed"
        ? "border-border-strong bg-surface-sunken text-fg-muted"
        : "border-status-reach/40 bg-status-reach/10 text-status-reach";

  const dot =
    job.status === "open"
      ? "bg-status-safe"
      : job.status === "closed"
        ? "bg-fg-subtle"
        : "bg-status-reach";

  const label =
    job.status === "unknown"
      ? "No deadline"
      : job.status === "open"
        ? job.daysLeft === 0
          ? "Closes today"
          : `${job.daysLeft} ${job.daysLeft === 1 ? "day" : "days"} left`
        : `Closed ${Math.abs(job.daysLeft ?? 0)} ${
            Math.abs(job.daysLeft ?? 0) === 1 ? "day" : "days"
          } ago`;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function JobCard({ job, onOpen }: { job: JobWithStatus; onOpen: () => void }) {
  return (
    // A cell in the hairline grid above, opaque so the seam colour shows only
    // between cells.
    <div className="flex h-full flex-col bg-background p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip job={job} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
          {job.jobType}
        </span>
      </div>

      <p className="mt-3 font-sans text-sm font-bold leading-snug text-foreground">
        {job.title}
      </p>

      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
        {job.organization}
        {job.city && <span className="text-fg-subtle"> · {job.city}</span>}
      </p>

      {job.education.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.education.map((e) => (
            <span
              key={e}
              className="rounded-sm border border-border-strong px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-fg-muted"
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Pushed to the bottom so cards in a row line up regardless of how many
          education chips each carries. */}
      <div className="mt-auto pt-4">
        <p className="font-mono text-[10px] text-fg-subtle">
          {job.vacancies.length}{" "}
          {job.vacancies.length === 1 ? "role" : "roles"} · apply by{" "}
          {formatDate(job.deadline)}
        </p>

        <button
          type="button"
          onClick={onOpen}
          className="mt-3 w-full rounded-sm border border-border-strong px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
        >
          View details
        </button>
      </div>
    </div>
  );
}

/**
 * The detail sheet.
 *
 * Rendered through `createPortal` into `document.body`: `<Reveal>` carries a
 * transform, which makes it the containing block for any `position: fixed`
 * descendant, and a sheet anchored to a wrapper instead of the viewport is a
 * trap this project has already hit twice.
 */
function JobModal({ job, onClose }: { job: JobWithStatus; onClose: () => void }) {
  const { ref: linkIcon, handlers } = useActionIcon();

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={job.title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-lg border border-border-strong bg-surface p-6 shadow-ambient sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <StatusChip job={job} />
            <h2 className="mt-3 font-sans text-lg font-black leading-tight text-foreground">
              {job.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-sm border border-border-strong px-2.5 py-1 font-mono text-xs text-fg-muted transition-colors hover:border-accent hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <dl className="mt-6 grid gap-px bg-border sm:grid-cols-2">
          <Row label="Organization" value={job.organization} />
          <Row label="Location" value={job.location || job.city} />
          <Row label="Posted" value={formatDate(job.posted)} />
          <Row
            label="Apply by"
            value={formatDate(job.deadline)}
            hint={job.deadlineNote}
          />
          <Row label="Type" value={job.jobType} />
          <Row label="Sector" value={job.category} />
          {job.newspaper && <Row label="Advertised in" value={job.newspaper} />}
          {job.applyOnline && <Row label="How to apply" value={job.applyOnline} />}
        </dl>

        {job.education.length > 0 && (
          <Section title="Education">
            <p className="text-[13px] leading-relaxed text-fg-muted">
              {job.education.join(", ")}
            </p>
          </Section>
        )}

        {job.vacancies.length > 0 && (
          <Section title={`Vacancies (${job.vacancies.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {job.vacancies.map((v) => (
                <span
                  key={v}
                  className="rounded-sm border border-border-strong px-2 py-0.5 text-[11px] text-fg-muted"
                >
                  {v}
                </span>
              ))}
            </div>
          </Section>
        )}

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            {...handlers}
            className="group mt-6 flex min-h-[46px] w-full items-center justify-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
          >
            Open the original posting
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <ArrowUpRight01Icon ref={linkIcon} size={ICON_SIZE_SM} aria-hidden />
            </span>
          </a>
        )}
      </div>
    </div>,
    document.body
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="bg-surface p-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] font-bold leading-snug text-foreground">
        {value || "—"}
        {hint && (
          <span className="ml-1.5 font-mono text-[10px] font-normal text-fg-subtle">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
        {title}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
