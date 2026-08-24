import "server-only";

import { cookies } from "next/headers";

/**
 * Simulation config — the portal's Config tab.
 *
 * The original keeps three settings and promises that "changes apply
 * immediately across all tabs". Two of them are Firestore-driven and one is
 * not, and the difference decides what is portable:
 *
 * - **Status scope** is fully defined in the original's own source, as five
 *   named sets of verification status ids. Ported verbatim, and it genuinely
 *   changes every simulation on the site.
 * - **Merit formula** is a list of options with `base`, `sumFields` and
 *   `adjustments` loaded from the owner's Firestore. Only "Official" — base
 *   `marksTotal` — is knowable from anything we hold. The second option,
 *   "MS/MD Marks Adjusted", exists only as a definition we do not have.
 * - **Candidate revision** re-derives every mark from an amendment, subtracting
 *   a per-field delta over `houseJob`, `position`, `mdcat` and `degree`. We
 *   hold the amendments but the engines read a precomputed `marks_total`, so
 *   applying one means recomputing the pool rather than flipping a switch.
 *
 * Faking the two we cannot honour would be worse than showing them as fixed:
 * a dropdown that changes nothing is a lie the reader acts on.
 *
 * ## Why a cookie
 *
 * Every portal page is server-rendered, so the setting has to be readable
 * while rendering. `localStorage` — which is where the original keeps it — is
 * not. A cookie is, it survives navigation, and it is per-browser rather than
 * per-account, which matches what this is: a viewing preference, not data.
 */

export const STATUS_SCOPE_COOKIE = "mn_status_scope";

export type StatusScopeId =
  | "all"
  | "accepted-pending"
  | "accepted"
  | "pending"
  | "rejected";

export type StatusScope = {
  id: StatusScopeId;
  label: string;
  description: string;
  /** Empty means "do not filter". */
  statusIds: number[];
};

/**
 * The five scopes, copied from `DEFAULT_SIM_STATUS_SCOPES` in the original's
 * `sim-consent.js` — ids, labels and descriptions included, because they are
 * the vocabulary its users already know.
 */
export const STATUS_SCOPES: StatusScope[] = [
  {
    id: "all",
    label: "All candidates",
    description: "Do not filter by verification status.",
    statusIds: [],
  },
  {
    id: "accepted-pending",
    label: "Accepted + Pending",
    description:
      "Candidates accepted in verification or amendment, plus pending.",
    statusIds: [1, 11],
  },
  {
    id: "accepted",
    label: "Accepted only",
    description:
      "Candidates accepted in verification or approved via amendment.",
    statusIds: [1],
  },
  {
    id: "pending",
    label: "Pending only",
    description: "Candidates still pending in verification.",
    statusIds: [11],
  },
  {
    id: "rejected",
    label: "Rejected only",
    description:
      "Candidates rejected after amendment process (or rejected with no amendment).",
    statusIds: [2],
  },
];

/**
 * The original's default, and ours.
 *
 * It also happens to be what `test:cascade` and `test:placement` grade against,
 * so leaving it alone leaves every published agreement figure untouched. A
 * reader who changes it is deliberately asking a different question.
 */
export const DEFAULT_SCOPE: StatusScopeId = "accepted";

export function scopeById(id: string | undefined | null): StatusScope {
  return (
    STATUS_SCOPES.find((scope) => scope.id === id) ??
    STATUS_SCOPES.find((scope) => scope.id === DEFAULT_SCOPE)!
  );
}

/** The scope in force for this request. */
export async function activeScope(): Promise<StatusScope> {
  const store = await cookies();
  return scopeById(store.get(STATUS_SCOPE_COOKIE)?.value);
}

/**
 * Whether a verification status is inside a scope.
 *
 * A missing record is `null`, and it is **not** the same as pending. Only the
 * unfiltered scope includes it — every named scope lists explicit ids, so a
 * candidate the portal has no record for cannot slip into one by default.
 */
export function inScope(scope: StatusScope, status: number | null): boolean {
  if (scope.statusIds.length === 0) return true;
  return status != null && scope.statusIds.includes(status);
}

/**
 * The applicants a scope admits, from the cached preference index.
 *
 * Derived per request rather than stored: the index is shared between readers
 * and cached per induction, so baking one reader's scope into it would hand
 * that scope to everybody.
 */
export function eligibleUnder(
  statusById: Map<number, number | null>,
  scope: StatusScope
): Set<number> {
  const out = new Set<number>();
  for (const [applicantId, status] of statusById) {
    if (inScope(scope, status)) out.add(applicantId);
  }
  return out;
}
