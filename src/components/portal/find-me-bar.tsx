"use client";

import { useEffect, useState } from "react";
import { Bezel } from "@/components/app/bezel";
import { SearchField } from "@/components/app/field";
import { Pill } from "@/components/portal/portal-terms";
import { findMyPosition, type FoundCandidate } from "@/lib/portal/find-me";
import { AddMeModal, useManualCandidate } from "@/components/portal/add-me-modal";
import { Search01Icon } from "@/components/ui/search-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The portal's identity bar.
 *
 * Type an applicant id and the portal remembers who you are, so your rows stand
 * out wherever they appear. The original keeps this in `localStorage` and so
 * does this — it is a viewing preference, not an account. Nothing is written to
 * the server, and clearing it leaves no trace.
 *
 * Storing an applicant id in the browser is not a disclosure: they are printed
 * on every published merit list. What the id unlocks here is highlighting of
 * rows already on screen, nothing more.
 */

const STORAGE_KEY = "mn_portal_applicant_id";

/** Read once on mount so other components can subscribe to the same value. */
export function useIdentifiedApplicant(): number | null {
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      setId(Number.isInteger(parsed) ? parsed : null);
    };
    read();

    // `storage` fires for other tabs; the custom event covers this one, since
    // a tab does not receive its own storage event.
    window.addEventListener("storage", read);
    window.addEventListener("mn-identity-changed", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("mn-identity-changed", read);
    };
  }, []);

  return id;
}

export function FindMeBar({
  seats,
}: {
  seats: Array<{ program: string; quota: string; specialty: string; hospital: string }>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const findIcon = useActionIcon();
  const manual = useManualCandidate();
  const [value, setValue] = useState("");
  const [found, setFound] = useState<FoundCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Restore whoever was identified last, and re-fetch so the summary reflects
  // the current data rather than a stale copy from a previous cycle.
  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    setValue(raw);
    void identify(raw, { silent: true });
    // Deliberately once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function identify(input: string, options?: { silent?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const result = await findMyPosition(input);
      if (result.ok) {
        setFound(result.candidate);
        window.localStorage.setItem(STORAGE_KEY, String(result.candidate.applicantId));
        window.dispatchEvent(new Event("mn-identity-changed"));
      } else {
        setFound(null);
        // A silent restore that fails should not shout at someone who has just
        // opened the page — it usually means a new cycle, not a mistake.
        if (!options?.silent) setError(result.error);
        window.localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event("mn-identity-changed"));
      }
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setFound(null);
    setError(null);
    setValue("");
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("mn-identity-changed"));
  }

  const latest = found?.appearances[0];

  return (
    <Bezel className="mt-6" innerClassName="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void identify(value);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label
            htmlFor="find-me"
            className="font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted"
          >
            Find my position
          </label>
          <SearchField
            id="find-me"
            value={value}
            inputMode="numeric"
            onChange={(e) => setValue(e.target.value)}
            placeholder="Applicant ID…"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !value.trim()}
          {...findIcon.handlers}
          className="flex min-h-[46px] items-center gap-2 rounded-sm bg-accent-strong px-5 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search01Icon ref={findIcon.ref} size={ICON_SIZE_SM} />
          {busy ? "Finding…" : "Find"}
        </button>

        {found && (
          <button
            type="button"
            onClick={clear}
            className="flex min-h-[46px] items-center rounded-sm border border-border-strong px-4 text-sm font-bold text-foreground transition-colors hover:border-accent"
          >
            Clear
          </button>
        )}

        {/* Not in any published round? The lookup above can never find you, so
            the way in is to supply yourself. */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex min-h-[46px] items-center rounded-sm border border-border-strong px-4 text-sm font-bold text-foreground transition-colors hover:border-accent"
        >
          {manual ? "Edit my entry" : "+ Add me manually"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-status-danger">{error}</p>
      )}

      {manual && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-4">
          <Pill tone="reach">Manual entry</Pill>
          <span className="font-sans text-sm font-bold text-foreground">
            {manual.name}
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-accent">
            {manual.marksTotal.toFixed(2)}
          </span>
          <span className="font-mono text-[10px] text-fg-subtle">
            {manual.preferences.length}{" "}
            {manual.preferences.length === 1 ? "preference" : "preferences"} · competes
            in simulations · stored in this browser only
          </span>
        </div>
      )}

      <AddMeModal seats={seats} open={modalOpen} onClose={() => setModalOpen(false)} />

      {found && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-sans text-sm font-bold text-foreground">
              {found.name}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
              {found.applicantId}
            </span>
            {found.pmdc && (
              <span className="font-mono text-[10px] text-fg-subtle">
                PMDC {found.pmdc}
              </span>
            )}
            <span className="font-mono text-[10px] text-fg-subtle">
              {found.appearances.length}{" "}
              {found.appearances.length === 1 ? "appearance" : "appearances"} this
              cycle
            </span>
          </div>

          {latest && (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-fg-muted">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                Round {latest.round}
              </span>
              <span className="font-bold text-foreground">{latest.specialty}</span>
              <span>@ {latest.hospital}</span>
              <span className="font-mono text-[10px] text-fg-subtle">
                ({latest.program}, {latest.quota})
              </span>
              {latest.marks != null && (
                <span className="font-mono text-xs font-bold tabular-nums text-accent">
                  {latest.marks.toFixed(2)}
                </span>
              )}
              {latest.preferenceNo != null && (
                <span className="font-mono text-[10px] text-fg-subtle">
                  P{latest.preferenceNo}
                </span>
              )}
              {latest.consent && (
                <Pill
                  tone={
                    latest.consent === "Accepted"
                      ? "safe"
                      : latest.consent === "Awaited"
                        ? "reach"
                        : "danger"
                  }
                >
                  {latest.consent}
                </Pill>
              )}
            </p>
          )}

          <p className="mt-2 font-mono text-[10px] text-fg-subtle">
            Your rows are highlighted across the portal. Stored in this
            browser only.
          </p>
        </div>
      )}
    </Bezel>
  );
}
