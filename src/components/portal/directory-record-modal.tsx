"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DirectoryRecord } from "@/lib/portal/directory";
import { Bezel } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { AlertIcon } from "@/components/icons/koboyo";

/**
 * One applicant's record — the original's row modal.
 *
 * Two tabs, as the original has them: Info carries the marks breakdown, the
 * amendment history and the preference list grouped by programme; Certificates
 * carries the full certificate records.
 *
 * Rendered through `createPortal` into `document.body`. `<Reveal>` carries a
 * transform, which would make it the containing block for `position: fixed` and
 * anchor this to the wrapper rather than the viewport — the trap that already
 * cost a mobile sheet on the merit table.
 *
 * The record arrives from a server action rather than with the table. Fifty
 * preference lists per page is exactly the payload this design exists to avoid,
 * and opening a row is a deliberate act where a fetch is affordable.
 */

const STATUS: Record<number, { label: string; tone: "safe" | "reach" | "danger" }> = {
  1: { label: "Accepted", tone: "safe" },
  2: { label: "Rejected", tone: "danger" },
  11: { label: "Pending", tone: "reach" },
};

export function DirectoryRecordModal({
  record,
  loading,
  onClose,
}: {
  record: DirectoryRecord | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"info" | "certificates">("info");

  useEffect(() => setMounted(true), []);

  // Back to Info whenever a different person is opened. Leaving the tab where
  // the last record left it shows the new one's certificates first, which reads
  // as the wrong card having opened.
  useEffect(() => setTab("info"), [record?.applicantId]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  if (!mounted) return null;

  const status =
    record?.profileStatus != null ? STATUS[record.profileStatus] : undefined;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Candidate record"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
    >
      <div className="w-full max-w-3xl rounded-lg bg-surface-sunken p-1 shadow-lifted ring-1 ring-border">
        <div className="rounded-[0.25rem] bg-surface p-6 shadow-[inset_0_1px_0_var(--edge-highlight)]">
          {loading || !record ? (
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                {loading ? "Loading record…" : "Record not available"}
              </p>
              <CloseButton onClose={onClose} />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-sans text-lg font-black tracking-tight text-foreground">
                    {record.name ?? `Applicant ${record.applicantId}`}
                    {record.amendments.length > 0 && (
                      <span
                        title={`${record.amendments.length} amendment${record.amendments.length === 1 ? "" : "s"} on this record`}
                        className="font-mono text-[10px] font-normal uppercase tracking-wider text-status-reach"
                      >
                        ✎ amended
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
                    <span>
                      ID{" "}
                      <span className="font-bold text-foreground">
                        {record.applicantId}
                      </span>
                    </span>
                    {record.pmdc && <span>PMDC {record.pmdc}</span>}
                    <span>
                      Total{" "}
                      <span className="font-bold text-accent">
                        {record.marksTotal != null
                          ? record.marksTotal.toFixed(2)
                          : "—"}
                      </span>
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {status ? (
                      <Pill tone={status.tone}>{status.label}</Pill>
                    ) : (
                      <Pill tone="plain">No verification record</Pill>
                    )}
                    {record.appliedIn.map((program) => (
                      <Pill key={program} tone="accent">
                        {program}
                      </Pill>
                    ))}
                  </div>
                </div>

                <CloseButton onClose={onClose} />
              </div>

              <div className="mt-5 flex gap-1 border-b border-border">
                <Tab active={tab === "info"} onClick={() => setTab("info")}>
                  Info
                </Tab>
                <Tab
                  active={tab === "certificates"}
                  onClick={() => setTab("certificates")}
                >
                  Certificates ({record.certificates.length})
                </Tab>
              </div>

              {tab === "info" ? (
                <InfoTab record={record} />
              ) : (
                <CertificatesTab record={record} />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function InfoTab({ record }: { record: DirectoryRecord }) {
  const scored = record.components.filter((c) => c.value != null);

  return (
    <>
      {/* The original's marks grid. Components the portal records as zero are
          shown as zero rather than hidden: a candidate checking their own
          record needs to see that a component counted for nothing, which is a
          different fact from it being absent. */}
      {scored.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-border sm:grid-cols-5">
          {record.components.map((component) => (
            <div key={component.label} className="bg-surface-sunken p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-fg-muted">
                {component.label}
              </p>
              <p
                className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                  component.value ? "text-foreground" : "text-fg-subtle"
                }`}
              >
                {component.value != null ? component.value.toFixed(2) : "—"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 font-mono text-[11px] text-fg-subtle">
          No marks breakdown on this record.
        </p>
      )}

      {record.amendments.length > 0 && (
        <div className="mt-5 rounded-sm bg-surface-sunken/70 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-status-reach">
            Amendments
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {record.amendments.map((amendment) => (
              <li key={amendment.label} className="text-xs text-fg-muted">
                <span className="font-bold text-foreground">
                  {amendment.label}
                </span>
                {amendment.fields.length > 0 && (
                  <span className="ml-2 font-mono text-[10px] text-fg-subtle">
                    {amendment.fields.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {record.programs.length === 0 ? (
        <p className="mt-6 font-mono text-[11px] text-fg-subtle">
          No preferences on this record.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {record.programs.map((group) => (
            <Bezel key={group.program} innerClassName="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
                <span className="font-sans text-sm font-bold text-foreground">
                  {group.program}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-fg-muted">
                  {group.preferences.length}{" "}
                  {group.preferences.length === 1 ? "seat" : "seats"}
                </span>
              </div>

              <ol className="mt-3 flex flex-col gap-2">
                {group.preferences.map((preference) => (
                  <li
                    key={`${preference.preferenceNo}-${preference.hospital}-${preference.quota}`}
                    className="flex flex-col gap-0.5"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="w-8 shrink-0 font-mono text-[10px] font-bold tabular-nums text-fg-subtle">
                        P{preference.preferenceNo}
                      </span>
                      <SpecialtyLabel
                        specialty={preference.specialty}
                        className="text-[13px]"
                      />
                    </div>
                    <p className="pl-8 font-mono text-[10px] leading-snug text-fg-subtle">
                      {preference.hospital}
                      <span className="mx-1.5">·</span>
                      {preference.quota}
                    </p>
                  </li>
                ))}
              </ol>
            </Bezel>
          ))}
        </div>
      )}
    </>
  );
}

function CertificatesTab({ record }: { record: DirectoryRecord }) {
  if (record.certificates.length === 0) {
    return (
      <p className="mt-5 font-mono text-[11px] text-fg-subtle">
        No certificates on this record.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-5 flex flex-col gap-2">
        {record.certificates.map((certificate, i) => (
          <li
            key={`${certificate.program}-${certificate.discipline}-${i}`}
            className="rounded-sm bg-surface-sunken/70 p-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-sans text-[13px] font-bold text-foreground">
                {certificate.program ?? "—"}
              </span>
              <span className="text-xs text-fg-muted">
                {certificate.discipline ?? "—"}
              </span>
              {certificate.status && (
                <Pill tone={certificate.valid === false ? "danger" : "safe"}>
                  {certificate.status}
                </Pill>
              )}
            </div>

            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-fg-subtle">
              {certificate.certificateMarks != null && (
                <span>
                  P:{" "}
                  <span className="font-bold text-foreground">
                    {certificate.certificateMarks.toFixed(2)}
                  </span>
                </span>
              )}
              {certificate.computerizedMarks != null && (
                <span>
                  C:{" "}
                  <span className="font-bold text-foreground">
                    {certificate.computerizedMarks.toFixed(2)}
                  </span>
                </span>
              )}
              <span>Percentage: {certificate.percentage || "—"}</span>
              {certificate.session && <span>Session: {certificate.session}</span>}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-fg-subtle">
        <AlertIcon className="mt-px h-3.5 w-auto shrink-0 text-fg-subtle" />
        <span>
          A certificate only lifts a mark on a seat whose preference names the
          same discipline, so it counts on some of these preferences and not
          others. The merit list prints the effective mark for the seat it is
          listing, which is why it can exceed the total above.
        </span>
      </p>
    </>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="shrink-0 font-mono text-lg leading-none text-fg-subtle transition-colors hover:text-foreground"
    >
      ×
    </button>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "border-accent text-accent"
          : "border-transparent text-fg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
