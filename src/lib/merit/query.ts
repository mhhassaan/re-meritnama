import type { MeritRow, MeritScale } from "./types";

/**
 * Filtering, searching and sorting for the merit table.
 *
 * Pure functions over plain arrays, deliberately: this is the logic a candidate
 * makes decisions from, and it should be verifiable without rendering anything.
 */

export type SortKey =
  | "specialty"
  | "hospital"
  | "latest"
  | "average"
  | "seats"
  | "trend";

export type SortDirection = "asc" | "desc";

export type MeritQuery = {
  program?: string;
  quota?: string;
  specialty?: string;
  hospital?: string;
  /** Free text over specialty and hospital. */
  search?: string;
  /** Restrict to rows with data in these inductions. */
  inductions?: number[];
  sort?: SortKey;
  direction?: SortDirection;
  scale?: MeritScale;
};

/**
 * Value shown for a cycle, on the requested scale.
 *
 * Returns null rather than 0 when a combination did not run that cycle — a seat
 * that did not exist and a seat that closed at zero are different facts, and
 * rendering both as "0" would invent history.
 */
export function valueFor(
  row: MeritRow,
  induction: number,
  scale: MeritScale
): number | null {
  const source = scale === "raw" ? row.yearly_merit : row.yearly_pct_of_max;
  const value = source?.[String(induction)];
  return typeof value === "number" ? value : null;
}

export function seatsFor(row: MeritRow, induction: number): number | null {
  const value = row.yearly_seats?.[String(induction)];
  return typeof value === "number" ? value : null;
}

/** Most recent cycle in which this combination actually ran. */
export function latestValue(row: MeritRow, scale: MeritScale): number | null {
  return valueFor(row, row.latest_induction, scale);
}

/**
 * The multi-cycle average, always as % of max — deliberately not scale-aware.
 *
 * `avg_closing_merit` exists in the source but averages raw marks taken from
 * cycles whose totals were 95, 60, 35 and 30. That number is arithmetic over
 * incommensurable units and means nothing, so it is never shown. The average
 * only has meaning normalised, and the UI labels it "of max" accordingly.
 */
export function averageValue(row: MeritRow): number {
  return row.avg_pct_of_max;
}

/** Total seats in the most recent cycle this combination ran. */
export function latestSeats(row: MeritRow): number | null {
  return seatsFor(row, row.latest_induction);
}

const TREND_ORDER: Record<string, number> = { falling: 0, stable: 1, rising: 2 };

function normalise(text: string): string {
  return text.toLowerCase().trim();
}

export function applyQuery(rows: MeritRow[], query: MeritQuery): MeritRow[] {
  const {
    program,
    quota,
    specialty,
    hospital,
    search,
    inductions,
    sort = "specialty",
    direction = "asc",
    scale = "normalised",
  } = query;

  const term = search ? normalise(search) : "";

  let result = rows.filter((row) => {
    if (program && row.program !== program) return false;
    if (quota && row.quota !== quota) return false;
    if (specialty && row.specialty !== specialty) return false;
    if (hospital && row.hospital !== hospital) return false;

    // Matches the original's behaviour: free text searches specialty and
    // hospital only. Applicant name and PMDC search belong to the merit LIST,
    // which is candidate-level data behind sign-in — not this table.
    if (term) {
      const haystack = `${row.specialty} ${row.hospital}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    // A cycle filter must mean "ran in one of these cycles", not "has any data".
    if (inductions && inductions.length > 0) {
      const ran = inductions.some(
        (i) => typeof row.yearly_merit?.[String(i)] === "number"
      );
      if (!ran) return false;
    }

    return true;
  });

  const factor = direction === "asc" ? 1 : -1;

  // Nulls always sort last regardless of direction: a combination with no data
  // is not "the lowest", it is absent, and floating it to the top of a
  // descending sort would be misleading.
  const compareNumbers = (a: number | null, b: number | null) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return (a - b) * factor;
  };

  result = [...result].sort((a, b) => {
    switch (sort) {
      case "hospital":
        return a.hospital.localeCompare(b.hospital) * factor;
      case "latest":
        return compareNumbers(latestValue(a, scale), latestValue(b, scale));
      case "average":
        return compareNumbers(averageValue(a), averageValue(b));
      case "seats":
        return compareNumbers(latestSeats(a), latestSeats(b));
      case "trend":
        return (
          ((TREND_ORDER[a.trend] ?? 1) - (TREND_ORDER[b.trend] ?? 1)) * factor
        );
      case "specialty":
      default: {
        const bySpecialty = a.specialty.localeCompare(b.specialty) * factor;
        // Hospital as the tiebreak so rows for one specialty stay grouped in a
        // stable order rather than shuffling between renders.
        return bySpecialty !== 0
          ? bySpecialty
          : a.hospital.localeCompare(b.hospital);
      }
    }
  });

  return result;
}

/**
 * Formats a merit value for display.
 *
 * Normalised values carry a % sign; raw values do not, and are meaningless
 * without knowing the cycle's total — which is why the UI must always show the
 * scale alongside them.
 */
export function formatValue(value: number | null, scale: MeritScale): string {
  if (value == null) return "—";
  return scale === "raw" ? value.toFixed(2) : `${value.toFixed(1)}%`;
}
