import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole, isStaffRole } from "@/lib/auth/roles";
import { AccessRequestRow } from "@/components/admin/access-request-row";

export const metadata: Metadata = {
  title: "Access Requests | MeritNama Staff",
};

// Approvals must reflect the moment they are viewed, not a cached snapshot.
export const dynamic = "force-dynamic";

const STATUS_ORDER = ["pending", "approved", "rejected"] as const;

export default async function AdminAccessRequestsPage() {
  // Repeated here, not only in the layout. A layout calling notFound() sets the
  // 404 status but does NOT stop this component from rendering — verified: a
  // signed-in candidate requesting /admin received a 404 whose body still
  // contained this page's rendered output. Nothing sensitive appeared, because
  // RLS returned no rows, but the query ran. Checking here means it does not.
  const role = await getCurrentRole();
  if (!isStaffRole(role)) notFound();

  // Read as the signed-in staff member, so the same RLS policy that authorises
  // the data authorises this listing. Only the write actions escalate to the
  // service role, and each re-checks the caller's role.
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("access_requests")
    .select(
      "email, applicant_id, induction, name_full, message, status, payment_declared, payment_amount_pkr, payment_reference, payment_verified, proof_object_path, created_at, reviewed_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    rows: (requests ?? []).filter((r) => r.status === status),
  }));

  const pendingCount = grouped.find((g) => g.status === "pending")?.rows.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.38em] text-accent">
        Access Requests
      </p>
      <h1 className="mt-3 font-sans text-3xl font-black tracking-tight sm:text-4xl">
        {pendingCount} awaiting review
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
        Each request was already matched against an Induction 21 record.
        Approving sends an invite to the address on that record.
      </p>

      {error && (
        <p className="mt-6 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs text-status-danger">
          Could not load requests: {error.message}
        </p>
      )}

      {grouped.map(({ status, rows }) => (
        <section key={status} className="mt-10">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            {status} ({rows.length})
          </h2>

          {rows.length === 0 ? (
            <p className="mt-3 text-xs text-fg-subtle">None.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {rows.map((r) => (
                <AccessRequestRow key={r.email} request={r} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
