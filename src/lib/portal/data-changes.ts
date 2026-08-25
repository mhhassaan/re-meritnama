import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";
import {
  CHANGE_FIELDS,
  CHANGE_PRESETS,
  type CandidateChange,
  type ChangeKind,
  type DataChangesView,
} from "./data-changes-fields";

/**
 * Candidate Data Changes — what the portal altered between two snapshots of
 * the applicant file.
 *
 * Read **as the caller** from `data_changes` and `data_change_runs`, both gated
 * on `private.is_verified()`. Nothing is cached across requests: the whole diff
 * is 3,078 rows, so there is nothing to gain, and caching a table with a
 * per-user policy is an access-control bypass waiting for the day the policy
 * narrows.
 *
 * ## The framing correction, which is the reason this page differs
 *
 * The original prints, on every one of its 440 total-marks rows, a sentence in
 * the second person: *"Your total went up by 17.1343 points."*
 *
 * That is true of almost none of them. 358 of the 440 move from 0 to a real
 * mark and 25 move the other way, because 0 in the applicant file means **no
 * record**, not a score of nought. Those are records being populated and
 * blanked as the portal finished data entry. Only **57** are a revision between
 * two real values, and most of those are a bare MDCAT score becoming a full
 * record — 1.63 to 17.38 and so on.
 *
 * A candidate reading the original's page sees hundreds of people apparently
 * gaining fifteen points and concludes the merit list is unstable. Every row
 * carries a `kind` from ingest so the three can be told apart, and "revised" is
 * its own filter because it is the only one that describes a mark changing.
 *
 * ## The whole diff is sent at once, and filtered in the browser
 *
 * 622 candidates and 3,078 field changes is a few hundred kilobytes — small
 * enough that search can run per keystroke without a round trip, which is what
 * this page is for. Only the markup is deferred, in batches, the same
 * arrangement Seat Allocation uses and for the same reason.
 *
 * ## Names
 *
 * From `pool_directory`, which is parentage-stripped at ingest and withholds
 * the three records whose entire name field is a CNIC. The diff's own
 * `nameFull` is never read — see the migration for why.
 */

export {
  CHANGE_FIELDS,
  CHANGE_PRESETS,
  type ChangePreset,
  type ChangeKind,
  type FieldChange,
  type CandidateChange,
  type DataChangesSummary,
  type DataChangesView,
} from "./data-changes-fields";

/** PostgREST caps a response at 1,000 rows regardless of the range asked for. */
const PAGE = 1000;

const EMPTY: DataChangesView = { ok: false, summary: null, candidates: [] };

type Row = {
  applicant_id: number;
  field: string;
  program: string;
  old_value: number | null;
  new_value: number | null;
  kind: string;
};

export async function loadDataChanges(
  induction = CURRENT_INDUCTION
): Promise<DataChangesView> {
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("data_change_runs")
    .select("*")
    .eq("induction", induction)
    .maybeSingle();

  // No run means either nothing ingested or the caller is not verified. Both
  // render the same empty page on purpose: telling them apart would report
  // back on the caller's own permissions.
  if (!run) return EMPTY;

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("data_changes")
      .select("applicant_id, field, program, old_value, new_value, kind")
      .eq("induction", induction)
      .order("applicant_id", { ascending: true })
      .order("field", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) return EMPTY;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const byCandidate = new Map<number, CandidateChange>();
  for (const row of rows) {
    let entry = byCandidate.get(row.applicant_id);
    if (!entry) {
      entry = {
        applicantId: row.applicant_id,
        name: null,
        changes: [],
        marksDelta: null,
        marksKind: null,
        isNew: false,
      };
      byCandidate.set(row.applicant_id, entry);
    }

    entry.changes.push({
      field: row.field,
      label: CHANGE_FIELDS[row.field] ?? row.field,
      program: row.program || null,
      oldValue: row.old_value,
      newValue: row.new_value,
      kind: row.kind as ChangeKind,
    });

    if (row.field === "marksTotal") {
      entry.marksDelta = (row.new_value ?? 0) - (row.old_value ?? 0);
      entry.marksKind = row.kind as ChangeKind;
    }
    if (row.field === "record") entry.isNew = true;
  }

  const candidates = [...byCandidate.values()];
  await attachNames(supabase, candidates, induction);

  const marks = { appeared: 0, vanished: 0, revised: 0 };
  for (const candidate of candidates) {
    if (candidate.marksKind && candidate.marksKind in marks) {
      marks[candidate.marksKind as keyof typeof marks] += 1;
    }
  }

  const byPreset: Record<string, number> = {};
  for (const preset of CHANGE_PRESETS) {
    byPreset[preset.id] = preset.fields
      ? candidates.filter((c) =>
          c.changes.some((change) => preset.fields!.includes(change.field))
        ).length
      : candidates.length;
  }

  return {
    ok: true,
    summary: {
      generatedAt: run.generated_at,
      oldCount: run.old_count,
      newCount: run.new_count,
      added: run.added,
      removed: run.removed,
      changed: run.changed,
      totalUpdates: run.total_updates,
      marks,
      byPreset,
    },
    candidates,
  };
}

/**
 * Fills in display names from `pool_directory`.
 *
 * Chunked because 622 applicant ids in a single `in.(…)` is a four-kilobyte
 * query string, and PostgREST takes its filters in the URL.
 */
async function attachNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidates: CandidateChange[],
  induction: number
) {
  const ids = candidates.map((c) => c.applicantId);
  const names = new Map<number, string>();

  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("pool_directory")
      .select("applicant_id, name_full")
      .eq("induction", induction)
      .in("applicant_id", ids.slice(i, i + 200));

    for (const row of data ?? []) {
      if (row.name_full) names.set(row.applicant_id, row.name_full);
    }
  }

  for (const candidate of candidates) {
    candidate.name = names.get(candidate.applicantId) ?? null;
  }
}
