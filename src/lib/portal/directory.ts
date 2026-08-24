import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_INDUCTION } from "@/lib/induction";

/**
 * The Candidate Pool roster — the original's table, read as the caller.
 *
 * ## Read as the caller, deliberately
 *
 * Every other bulk portal read goes through the service role, because
 * `applicants` has no policy at all. This one does not: `pool_directory` is
 * gated on `private.is_verified()`, so RLS decides, and an unverified account
 * gets an empty page without this file having to check anything. That is the
 * whole point of putting the identity in its own table rather than bolting a
 * name column onto the pool the engine reads.
 *
 * ## Everything is done in the database
 *
 * Search, sort and paging are `.or()`, `.order()` and `.range()`, not a fetch
 * of 3,474 rows filtered in Node. Three reasons, in order of how much they
 * matter:
 *
 * 1. **No request ever returns the whole pool.** That is the difference between
 *    a roster and a dump, and it is a property of the query rather than of the
 *    UI being careful.
 * 2. The rows are heavy — preference lists run to 358 entries — so the whole
 *    table is tens of megabytes. The merit list learned this at 14.8 seconds.
 * 3. PostgREST caps a response at 1,000 rows anyway, so a client-side filter
 *    over "everything" would silently be a filter over the first thousand.
 *
 * The row shape sent to the browser is narrower still: the table columns only.
 * Preferences, components, certificates and revisions are fetched **one record
 * at a time** by `loadDirectoryRecord`, when a row is actually opened.
 */

export const ROSTER_PAGE = 50;

export type RosterSort = "marks" | "name" | "id";

export type RosterRow = {
  applicantId: number;
  name: string | null;
  pmdc: string | null;
  marksTotal: number | null;
  profileStatus: number | null;
  /** Programmes the portal records them as having applied to. */
  appliedIn: string[];
  /** Whether the record carries an amendment — the original's "✎" badge. */
  amended: boolean;
};

export type RosterFilters = {
  search?: string;
  program?: string;
  status?: number;
  sort?: RosterSort;
  page?: number;
};

export type RosterView = {
  rows: RosterRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** False when the caller is not verified, so the page can say why. */
  ok: boolean;
};

type RosterRecord = {
  applicant_id: number;
  name_full: string | null;
  pmdc_no: string | null;
  marks_total: number | null;
  profile_status: number | null;
  applied_in: unknown;
  revisions: unknown;
};

/**
 * Programmes from the portal's `applied_in` object.
 *
 * The original's stats bar counts THIS, not the preference list, and the two
 * disagree: 100 applicants have `applied_in` empty while only one filed no
 * preferences. Reading the same field is what makes our counts match theirs.
 */
function appliedProgrammes(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, applied]) => Boolean(applied))
    .map(([program]) => program);
}

const hasRevision = (value: unknown) =>
  Boolean(value && typeof value === "object" && Object.keys(value).length > 0);

export async function loadRoster(
  filters: RosterFilters = {},
  induction: number = CURRENT_INDUCTION
): Promise<RosterView> {
  const supabase = await createClient();

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const from = (page - 1) * ROSTER_PAGE;

  let query = supabase
    .from("pool_directory")
    // Never `select("*")`. The narrow list is what keeps preference lists,
    // components and certificates out of a response that returns 50 people at
    // once — those are fetched one record at a time, when a row is opened.
    .select(
      "applicant_id, name_full, pmdc_no, marks_total, profile_status, applied_in, revisions",
      { count: "exact" }
    )
    .eq("induction", induction);

  const term = filters.search?.trim();
  if (term) {
    // Name, PMDC or applicant id, matching the original's single search box.
    // `or` needs the value inlined, so commas and parentheses are stripped:
    // they are PostgREST's own separators and would otherwise be read as more
    // filters rather than as text to match.
    const safe = term.replace(/[,()]/g, " ").trim();
    const digits = /^\d+$/.test(safe);
    query = query.or(
      digits
        ? `applicant_id.eq.${safe},name_full.ilike.*${safe}*,pmdc_no.ilike.*${safe}*`
        : `name_full.ilike.*${safe}*,pmdc_no.ilike.*${safe}*`
    );
  }

  if (filters.program) {
    // `applied_in` is an object keyed by programme, so containment is the test:
    // "has a truthy FCPS key".
    query = query.contains("applied_in", { [filters.program]: true });
  }

  if (filters.status != null) {
    query = query.eq("profile_status", filters.status);
  }

  const sort = filters.sort ?? "marks";
  if (sort === "name") query = query.order("name_full", { ascending: true });
  else if (sort === "id") query = query.order("applicant_id", { ascending: true });
  else query = query.order("marks_total", { ascending: false, nullsFirst: false });

  // A stable tiebreak, or two people on the same mark can swap places between
  // pages and one of them is never shown at all.
  query = query.order("applicant_id", { ascending: true });

  const { data, error, count } = await query.range(from, from + ROSTER_PAGE - 1);

  // An RLS denial is an empty result, not an exception — so "no rows and no
  // count" is how an unverified caller arrives here.
  if (error) {
    return { rows: [], total: 0, page: 1, pageCount: 1, pageSize: ROSTER_PAGE, ok: false };
  }

  const rows = ((data ?? []) as RosterRecord[]).map((row) => ({
    applicantId: row.applicant_id,
    name: row.name_full,
    pmdc: row.pmdc_no,
    marksTotal: row.marks_total != null ? Number(row.marks_total) : null,
    profileStatus: row.profile_status,
    appliedIn: appliedProgrammes(row.applied_in),
    amended: hasRevision(row.revisions),
  }));

  const total = count ?? rows.length;

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ROSTER_PAGE)),
    pageSize: ROSTER_PAGE,
    ok: true,
  };
}

/* -------------------------------------------------------------------------- */

export type DirectoryPreference = {
  preferenceNo: number;
  program: string;
  quota: string;
  specialty: string;
  hospital: string;
  institute: string | null;
};

export type DirectoryCertificate = {
  discipline: string | null;
  program: string | null;
  status: string | null;
  session: string | null;
  certificateMarks: number | null;
  computerizedMarks: number | null;
  percentage: string | null;
  valid: boolean | null;
};

export type DirectoryRecord = {
  applicantId: number;
  name: string | null;
  pmdc: string | null;
  marksTotal: number | null;
  profileStatus: number | null;
  appliedIn: string[];
  /** The nine-cell grid the original prints, in its own order. */
  components: Array<{ label: string; value: number | null }>;
  programs: Array<{ program: string; preferences: DirectoryPreference[] }>;
  certificates: DirectoryCertificate[];
  amendments: Array<{ label: string; fields: string[] }>;
};

/**
 * The original's marks grid, in the original's order.
 *
 * Matric and FSc are carried by the source and shown, even though the current
 * policy scores neither — the Calculator's "no longer counted" list says the
 * same thing, and hiding a component a candidate can see on the real portal
 * makes this look like it is missing data rather than reporting a policy.
 */
const COMPONENTS: Array<[key: string, label: string]> = [
  ["degree", "Degree"],
  ["houseJob", "House Job"],
  ["experience", "Experience"],
  ["research", "Research"],
  ["position", "Position"],
  ["hardAreas", "Hard Areas"],
  ["matric", "Matric"],
  ["fsc", "FSc"],
  ["attempts", "Attempts"],
  ["mdcat", "MDCAT"],
];

const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * One person's full record, fetched only when their row is opened.
 *
 * Same policy, same table — but a single row rather than fifty, which is what
 * keeps preference lists out of the roster payload. Opening a record is a
 * deliberate act; scrolling a table is not.
 */
export async function loadDirectoryRecord(
  applicantId: number,
  induction: number = CURRENT_INDUCTION
): Promise<DirectoryRecord | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("pool_directory")
    .select(
      "applicant_id, name_full, pmdc_no, marks_total, profile_status, applied_in, components, preferences, certificates, revisions"
    )
    .eq("induction", induction)
    .eq("applicant_id", applicantId)
    .maybeSingle();

  if (!data) return null;

  const rawComponents = (data.components ?? {}) as Record<string, unknown>;
  const rawPreferences = (Array.isArray(data.preferences) ? data.preferences : []) as Array<
    Record<string, unknown>
  >;
  const rawCertificates = (Array.isArray(data.certificates)
    ? data.certificates
    : []) as Array<Record<string, unknown>>;
  const rawRevisions = (data.revisions ?? {}) as Record<string, unknown>;

  const grouped = new Map<string, DirectoryPreference[]>();
  for (const preference of rawPreferences) {
    const program = t(preference.program);
    const entry: DirectoryPreference = {
      preferenceNo: Number(preference.preference_no ?? 0),
      program,
      quota: t(preference.quota),
      specialty: t(preference.specialty),
      hospital: t(preference.hospital),
      institute: t(preference.institute) || null,
    };
    const list = grouped.get(program);
    if (list) list.push(entry);
    else grouped.set(program, [entry]);
  }

  return {
    applicantId: data.applicant_id,
    name: data.name_full,
    pmdc: data.pmdc_no,
    marksTotal: data.marks_total != null ? Number(data.marks_total) : null,
    profileStatus: data.profile_status,
    appliedIn: appliedProgrammes(data.applied_in),
    components: COMPONENTS.map(([key, label]) => ({
      label,
      value: numOrNull(rawComponents[key]),
    })),
    programs: [...grouped.entries()]
      .map(([program, preferences]) => ({
        program,
        preferences: preferences.sort((a, b) => a.preferenceNo - b.preferenceNo),
      }))
      .sort(
        (a, b) =>
          b.preferences.length - a.preferences.length ||
          a.program.localeCompare(b.program)
      ),
    certificates: rawCertificates.map((certificate) => ({
      discipline: t(certificate.disciplineName) || null,
      program: t(certificate.typeName) || null,
      status: t(certificate.status) || null,
      session: t(certificate.session) || null,
      certificateMarks: numOrNull(certificate.certificateMarks),
      computerizedMarks: numOrNull(certificate.computerizedMarks),
      percentage: t(certificate.percentage) || null,
      valid:
        typeof certificate.valid === "boolean" ? certificate.valid : null,
    })),
    amendments: Object.entries(rawRevisions).map(([label, value]) => ({
      // "amendment_1" as the portal writes it, tidied for display.
      label: label.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      // Underscore-prefixed keys are the portal's own bookkeeping — `_timestamp`
      // is when the amendment was written, not a field that was amended, and
      // listing it told the reader their timestamp had been changed.
      fields:
        value && typeof value === "object"
          ? Object.keys(value as Record<string, unknown>).filter(
              (key) => !key.startsWith("_")
            )
          : [],
    })),
  };
}
