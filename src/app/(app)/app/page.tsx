import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Candidate Portal | MeritNama",
};

/**
 * Candidate portal home.
 *
 * Every query below runs as the signed-in user, so Row Level Security decides
 * what comes back. Nothing here filters by user id in application code — if the
 * policies were wrong, this page would show the wrong data, which is exactly
 * why the policies have their own test suite.
 */
export default async function AppHome() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Tier 2. Returns the caller's own record, or nothing — the policy resolves
  // it through candidate_links, so no applicant id is passed from the client.
  const { data: candidate } = await supabase
    .from("candidates")
    .select("applicant_id, induction, name_full, pmdc_no, marks_total, preferences")
    .maybeSingle();

  // Tier 1. Gazette-equivalent, visible to every verified user.
  const { count: meritCount } = await supabase
    .from("merit_entries")
    .select("id", { count: "exact", head: true });

  const preferences = Array.isArray(candidate?.preferences)
    ? (candidate.preferences as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.38em] text-accent">
        Candidate Portal
      </p>
      <h1 className="mt-3 font-sans text-3xl font-black tracking-tight sm:text-4xl">
        {candidate ? candidate.name_full : "Welcome"}
      </h1>

      {!candidate && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Your account is not yet linked to an Induction 21 candidate record, so
          your personal figures are unavailable. Gazette data below is still
          accessible. If you believe this is an error, contact an administrator.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {/* An applicant id means nothing without its cycle — the same number
            belongs to a different person in another induction. */}
        <Stat
          label="Applicant ID"
          value={
            candidate
              ? `${candidate.applicant_id}  ·  Induction ${candidate.induction}`
              : "—"
          }
        />
        <Stat
          label="Aggregate Marks"
          value={candidate?.marks_total != null ? String(candidate.marks_total) : "—"}
        />
        <Stat
          label="Preferences Submitted"
          value={preferences.length ? String(preferences.length) : "—"}
        />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/merit"
          className="group rounded-md border border-border bg-surface p-5 transition-colors hover:border-accent"
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            Merit Table
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-accent">
            1,470
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            Closing merits by specialty, hospital, programme and quota across 13
            induction cycles.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-bold text-accent">
            Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <div className="rounded-md border border-border bg-surface p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            Gazette Records Available
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-accent">
            {meritCount?.toLocaleString("en-GB") ?? "0"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            Merit entries across Induction 21. Prediction, calculator and the
            cascade simulator are not built yet.
          </p>
        </div>
      </div>

      <p className="mt-8 font-mono text-[11px] text-fg-subtle">
        Signed in as {user?.email}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
        {label}
      </p>
      {/* Monospace for all numerics, per the design guidelines. */}
      <p className="mt-2 font-mono text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
