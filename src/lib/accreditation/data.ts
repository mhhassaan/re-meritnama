import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * CPSP accredited programmes.
 *
 * The original's framing, kept: "CPSP Accredited Programs. Official FCPS
 * accreditation data from CPSP — search by hospital, city, or speciality."
 *
 * ## There was no missing dataset
 *
 * `NOT_IMPLEMENTED.md` had this tagged **data**, on the reasoning that 5,587
 * accredited programmes are a CPSP dataset we do not hold. That was wrong:
 * `public/data/cpsp_accreditation.json` has been in the repo the whole time,
 * 849 KB, 542 hospital records over 5,587 programmes. Nothing needed
 * ingesting, and nothing needed a table.
 *
 * It is also the one dataset on this site with no personal data in it at all —
 * a hospital, a city, a speciality, a unit, an accreditation code and a date.
 * So it sits in `public/data/` beside the other aggregates rather than behind a
 * policy, and is read here with `readFile` on the server, which means the file
 * is never shipped to a browser that did not ask for a row of it.
 *
 * ## Two things the source is inconsistent about, both left alone
 *
 * `unit` is written as both `Unit-I` and `Unit-1` — Roman on some records,
 * Arabic on others. Normalising would make the column tidier and would also
 * silently rewrite what CPSP published. It is displayed verbatim.
 *
 * Five hospitals appear twice under the same name with different programme
 * lists, which is why 542 records carry 537 distinct hospitals. The live site
 * prints 537 and so does this — the count is of institutions, not of rows in
 * the file.
 *
 * ## A row is a register entry, not a training unit
 *
 * 58 of the 5,587 rows are byte-identical to another row: same hospital string,
 * speciality, unit, code and date. Separately, some institutions are listed
 * under several spellings — King Edward appears as "…& AFFILIATED HOSPITAL",
 * "…HOSPITALS" and "…HOSPITALS, LAHORE", all carrying Cardiology Unit-I from
 * the same date, so a filter for Cardiology in Lahore returns three rows for
 * what is one unit.
 *
 * Neither is corrected. Collapsing the exact duplicates would be safe but would
 * make the headline disagree with CPSP's own for a reason the reader cannot
 * see; collapsing the spelling variants needs a fuzzy match and a choice of
 * canonical name, which is rewriting the register rather than reporting it. The
 * counts match the official page and the page says what a row is.
 *
 * ## The dates are DD-MM-YYYY
 *
 * The same shape that broke the joining export and the schedule.
 * `new Date("22-05-2017")` is `Invalid Date`, and where the day is 12 or below
 * it silently returns the wrong month. The original sidesteps it by printing
 * the raw string; the components are read textually here and rebuilt as ISO, so
 * the column can be sorted and formatted like every other date on the site.
 */

const DATA_DIR = join(process.cwd(), "public", "data");

export type AccreditationRow = {
  hospital: string;
  city: string;
  speciality: string;
  /** Verbatim from CPSP — `Unit-I` and `Unit-1` both occur. */
  unit: string;
  /** CPSP's own code: F.A., P.A., T.A., or a written-out phrase. */
  type: string;
  /** ISO, rebuilt from the source's DD-MM-YYYY. Null if unparseable. */
  since: string | null;
  /**
   * The date exactly as CPSP wrote it. Kept beside the ISO one so the table can
   * offer the register's own `DD-MM-YYYY` — and so a row whose date cannot be
   * parsed still shows what the source said rather than a dash.
   */
  sinceRaw: string;
};

export type AccreditationStats = {
  programs: number;
  /** Distinct institution names, not records in the file. */
  hospitals: number;
  cities: number;
  specialities: number;
  /** Programme count per accreditation code, commonest first. */
  byType: { type: string; count: number }[];
  /**
   * Rows that are byte-identical to another row — same hospital string, same
   * speciality, unit, code and date. 58 of them. See the note below.
   */
  duplicateRows: number;
};

export type AccreditationFacets = {
  cities: string[];
  specialities: string[];
  types: string[];
};

export type AccreditationFilters = {
  search?: string;
  city?: string;
  speciality?: string;
  type?: string;
  page?: number;
};

export type AccreditationView = {
  rows: AccreditationRow[];
  /** Programmes matching the filters, before the page slice. */
  matched: number;
  /** Programmes in the whole dataset. */
  total: number;
  page: number;
  pageCount: number;
  stats: AccreditationStats;
  facets: AccreditationFacets;
};

export const ROWS_PER_PAGE = 60;

type SourceHospital = {
  hospital: string;
  city: string;
  programs: { speciality: string; unit: string; type: string; since: string }[];
};

/**
 * `DD-MM-YYYY` to ISO, read as digits rather than parsed.
 *
 * Returns null rather than guessing: an accreditation date is what a candidate
 * uses to judge how established a unit is, and a wrong one is worse than none.
 */
function sinceIso(raw: string): string | null {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw?.trim() ?? "");
  if (!match) return null;

  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;

  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Loaded = {
  rows: AccreditationRow[];
  stats: AccreditationStats;
  facets: AccreditationFacets;
};

// Cached because the file is static, identical for every reader, and carries no
// personal data — none of the reasons that make a cache an access-control
// problem elsewhere in this codebase apply. The in-flight promise is cached as
// well as the result, or two requests arriving together each read the file.
let cached: Promise<Loaded> | null = null;

async function load(): Promise<Loaded> {
  const raw = await readFile(join(DATA_DIR, "cpsp_accreditation.json"), "utf8");
  const source = JSON.parse(raw) as SourceHospital[];

  const rows: AccreditationRow[] = [];
  const hospitals = new Set<string>();
  const cities = new Set<string>();
  const specialities = new Set<string>();
  const types = new Map<string, number>();
  const rowKeys = new Set<string>();
  let duplicateRows = 0;

  for (const record of source) {
    const hospital = record.hospital?.trim() ?? "";
    const city = record.city?.trim() ?? "";
    hospitals.add(hospital);
    cities.add(city);

    for (const program of record.programs ?? []) {
      const speciality = program.speciality?.trim() ?? "";
      const type = program.type?.trim() ?? "";
      specialities.add(speciality);
      types.set(type, (types.get(type) ?? 0) + 1);

      const row: AccreditationRow = {
        hospital,
        city,
        speciality,
        unit: program.unit?.trim() ?? "",
        type,
        since: sinceIso(program.since),
        sinceRaw: program.since?.trim() ?? "",
      };

      const key = `${hospital}|${speciality}|${row.unit}|${type}|${row.since}`;
      if (rowKeys.has(key)) duplicateRows += 1;
      else rowKeys.add(key);

      rows.push(row);
    }
  }

  const collate = (a: string, b: string) => a.localeCompare(b);

  return {
    rows,
    stats: {
      programs: rows.length,
      hospitals: hospitals.size,
      cities: cities.size,
      specialities: specialities.size,
      byType: [...types.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      duplicateRows,
    },
    facets: {
      cities: [...cities].sort(collate),
      specialities: [...specialities].sort(collate),
      types: [...types.keys()].sort(collate),
    },
  };
}

export async function loadAccreditation(
  filters: AccreditationFilters = {}
): Promise<AccreditationView> {
  cached ??= load().catch((error) => {
    // A failed read must not poison the cache, or one bad request breaks the
    // page until the process restarts.
    cached = null;
    throw error;
  });

  const { rows, stats, facets } = await cached;

  const term = filters.search?.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (filters.city && row.city !== filters.city) return false;
    if (filters.speciality && row.speciality !== filters.speciality) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (term) {
      // Hospital only, matching the original's field label ("Search hospital…").
      // City and speciality have their own dropdowns, so folding them into the
      // free-text box would make the two controls fight each other.
      if (!row.hospital.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(matched.length / ROWS_PER_PAGE));
  const page = Math.min(Math.max(1, Math.trunc(filters.page ?? 1) || 1), pageCount);

  return {
    // Sliced last, so every count describes the match rather than the batch.
    rows: matched.slice(0, page * ROWS_PER_PAGE),
    matched: matched.length,
    total: rows.length,
    page,
    pageCount,
    stats,
    facets,
  };
}
