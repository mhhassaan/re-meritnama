import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Medical job openings.
 *
 * The original's framing: "Current Job Openings. Browse current medical job
 * openings. Filter by role, organization, location, or status — deadlines and
 * availability update live."
 *
 * ## Deadlines do not update live, and that is the whole port
 *
 * Every posting carries an `isOpen` boolean written by the scraper at the
 * moment it ran. Nothing recomputes it. On the deployed site today, 149 of 153
 * postings show a green "Open" dot, and the first card in the grid is a job
 * whose stated deadline was **5 July 2026** — seven weeks past. Its detail
 * modal prints "5 days left" against a job that closed 26 days ago.
 *
 * So `isOpen` is never read here. Status is derived from the deadline against
 * the day the page is rendered, every time. That is also why the parsed file is
 * cached but the status is not: caching a computed "Open" would recreate the
 * original's bug with an expiry attached, exactly as the schedule's phases
 * would have gone stale if they had been cached.
 *
 * ## What we hold, and what the deployed site holds
 *
 * `public/data/jobs.json` is a snapshot of 75 postings scraped from jobz.pk on
 * **11 July 2026**. The deployed site shows 153, because its Jobs tab reads a
 * Firestore collection that the snapshot only seeds — `syncJobsFromSource`,
 * `_mergeJobsIntoFirestore`, `_subscribeJobs` in its own code. That project
 * belongs to the site's owner and is out of scope, so 75 is what this page has.
 *
 * Every deadline in the snapshot has now passed. The page says so rather than
 * printing an empty board or, worse, an open one. The moment a fresher file is
 * dropped in, the same code reports whatever is actually open — nothing here is
 * pinned to the July dates.
 *
 * ## Fields deliberately not carried
 *
 * `raw` duplicates every parsed field as scraped key-value pairs and is a
 * second copy of the same posting. `image` is null on all 75.
 * `onlineApplicants` reads "Be among the first 25 applicants" — that is
 * jobz.pk's own interface copy, not a fact about the vacancy, and reprinting it
 * here would attribute their marketing to the employer.
 */

const DATA_DIR = join(process.cwd(), "public", "data");

export type JobStatus = "open" | "closed" | "unknown";

export type Job = {
  id: string;
  title: string;
  organization: string;
  /** "Government", "Private", "Classifieds", … — the source's own vocabulary. */
  category: string;
  jobType: string;
  newspaper: string | null;
  education: string[];
  /** First component of the location, which is the city. */
  city: string;
  location: string;
  area: string | null;
  /** ISO. */
  posted: string | null;
  /** ISO. */
  deadline: string | null;
  /**
   * The qualifier the source appends to every deadline — "or as per paper ad".
   * Kept because it is the difference between a hard date and an indication.
   */
  deadlineNote: string | null;
  applyOnline: string | null;
  vacancies: string[];
  url: string | null;
};

export type JobWithStatus = Job & {
  status: JobStatus;
  /** Negative once the deadline has passed. Null when there is no deadline. */
  daysLeft: number | null;
};

export type JobsStats = {
  total: number;
  open: number;
  closed: number;
  unknown: number;
  organizations: number;
  cities: number;
  roles: number;
  /** Median days between posting and deadline, across the snapshot. */
  medianWindowDays: number | null;
};

export type JobsFacets = {
  organizations: string[];
  cities: string[];
  roles: string[];
  categories: string[];
  jobTypes: string[];
};

export type JobsView = {
  jobs: JobWithStatus[];
  stats: JobsStats;
  facets: JobsFacets;
  /** When the snapshot was scraped, ISO. */
  generatedAt: string | null;
  /** The day the status was computed against, ISO. */
  asOf: string;
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * `"11 July, 2026"` to ISO, read as words and digits rather than parsed.
 *
 * `new Date()` happens to accept this one, unlike the `DD/MM/YYYY` and
 * `DD-MM-YYYY` shapes elsewhere in this project — but it accepts it by
 * guessing, and the guess is locale-sensitive. Reading it explicitly costs four
 * lines and cannot drift.
 */
function postedIso(raw: string | null | undefined): string | null {
  const match = /^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/.exec(raw?.trim() ?? "");
  if (!match) return null;

  const [, day, month, year] = match;
  const m = MONTHS[month.toLowerCase()];
  const d = Number(day);
  if (!m || d < 1 || d > 31) return null;

  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Splits `"25 July, 2026or as per paper ad"` into the date and the qualifier. */
function splitDeadline(raw: string | null | undefined): {
  date: string | null;
  note: string | null;
} {
  const text = raw?.trim() ?? "";
  const match = /^(\d{1,2}\s+[A-Za-z]+,?\s+\d{4})(.*)$/.exec(text);
  if (!match) return { date: null, note: text || null };

  const note = match[2].trim();
  return { date: postedIso(match[1]), note: note || null };
}

const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");

type SourceJob = {
  title?: string;
  organization?: string;
  category?: string;
  jobType?: string;
  newspaper?: string | null;
  education?: string[];
  area?: string | null;
  location?: string;
  datePosted?: string;
  expectedLastDate?: string;
  expectedLastDateISO?: string;
  vacancies?: string[];
  applyOnline?: string | null;
  url?: string | null;
};

type Loaded = {
  jobs: Job[];
  facets: JobsFacets;
  generatedAt: string | null;
  medianWindowDays: number | null;
};

// Only the parsed file is cached. Status is derived per request from the
// deadline, because a cached "Open" is precisely the bug this page exists to
// avoid — see the header. The in-flight promise is cached too, or two requests
// arriving together each read the file.
let cached: Promise<Loaded> | null = null;

async function load(): Promise<Loaded> {
  const raw = await readFile(join(DATA_DIR, "jobs.json"), "utf8");
  const source = JSON.parse(raw) as {
    metadata?: { generatedAt?: string };
    jobs?: SourceJob[];
  };

  const jobs: Job[] = (source.jobs ?? []).map((record, index) => {
    // Field by field, so `raw` — a second copy of the whole posting — and the
    // frozen `isOpen` flag cannot arrive by accident.
    const location = t(record.location);
    const { date, note } = splitDeadline(record.expectedLastDate);

    return {
      // The source has no id. Title plus index is stable for a given file and
      // is only ever used as a React key and a modal handle.
      id: `${index}`,
      title: t(record.title) || "Untitled posting",
      organization: t(record.organization),
      category: t(record.category),
      jobType: t(record.jobType),
      newspaper: t(record.newspaper) || null,
      education: (record.education ?? []).map(t).filter(Boolean),
      city: location.split(",")[0]?.trim() ?? "",
      location,
      area: t(record.area) || null,
      posted: postedIso(record.datePosted),
      // Prefer the source's own ISO field, falling back to the one parsed out
      // of the display string. They agree on all 75 rows; the fallback is for
      // a future file where one is missing.
      deadline: t(record.expectedLastDateISO) || date,
      deadlineNote: note,
      applyOnline: t(record.applyOnline) || null,
      vacancies: (record.vacancies ?? []).map(t).filter(Boolean),
      url: t(record.url) || null,
    };
  });

  const collate = (a: string, b: string) => a.localeCompare(b);
  const distinct = (values: string[]) =>
    [...new Set(values.filter(Boolean))].sort(collate);

  const windows = jobs
    .map((job) =>
      job.posted && job.deadline
        ? Math.round(
            (Date.parse(`${job.deadline}T00:00:00Z`) -
              Date.parse(`${job.posted}T00:00:00Z`)) /
              86_400_000
          )
        : null
    )
    .filter((n): n is number => n != null && Number.isFinite(n))
    .sort((a, b) => a - b);

  return {
    jobs,
    facets: {
      organizations: distinct(jobs.map((j) => j.organization)),
      cities: distinct(jobs.map((j) => j.city)),
      roles: distinct(jobs.flatMap((j) => j.vacancies)),
      categories: distinct(jobs.map((j) => j.category)),
      jobTypes: distinct(jobs.map((j) => j.jobType)),
    },
    generatedAt: source.metadata?.generatedAt ?? null,
    medianWindowDays: windows.length
      ? windows[Math.floor(windows.length / 2)]
      : null,
  };
}

/**
 * Today in Pakistan, as an ISO date.
 *
 * These deadlines are set by Pakistani employers and printed in Pakistani
 * newspapers, so "has it closed" is a question about the wall clock in
 * Islamabad, not about wherever this happens to be rendering. Pakistan is
 * UTC+5 year-round with no daylight saving, so a fixed offset is exact rather
 * than an approximation — the same reasoning as the portal's schedule.
 */
function todayInPakistan(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
}

export async function loadJobs(): Promise<JobsView> {
  cached ??= load().catch((error) => {
    // A failed read must not poison the cache, or one bad request breaks the
    // page until the process restarts.
    cached = null;
    throw error;
  });

  const { jobs, facets, generatedAt, medianWindowDays } = await cached;

  const asOf = todayInPakistan();
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);

  const withStatus: JobWithStatus[] = jobs.map((job) => {
    if (!job.deadline) return { ...job, status: "unknown", daysLeft: null };

    const daysLeft = Math.round(
      (Date.parse(`${job.deadline}T00:00:00Z`) - asOfMs) / 86_400_000
    );

    // A deadline of today is still open: an application posted on the closing
    // day is on time, and rounding a candidate out of a job they could still
    // apply for is the expensive direction to be wrong in.
    return { ...job, status: daysLeft >= 0 ? "open" : "closed", daysLeft };
  });

  return {
    jobs: withStatus,
    stats: {
      total: withStatus.length,
      open: withStatus.filter((j) => j.status === "open").length,
      closed: withStatus.filter((j) => j.status === "closed").length,
      unknown: withStatus.filter((j) => j.status === "unknown").length,
      organizations: facets.organizations.length,
      cities: facets.cities.length,
      roles: facets.roles.length,
      medianWindowDays,
    },
    facets,
    generatedAt,
    asOf,
  };
}
