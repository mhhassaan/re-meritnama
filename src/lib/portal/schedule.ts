import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The induction schedule — the portal windows and when each one opens.
 *
 * Read from `public/data/induction21_schedule.json`, which is dates and step
 * names and carries nothing about any person, so it may live there.
 *
 * ## Phases, and why the source cannot simply be believed
 *
 * A step carries a `statusId` AND a date range, and they disagree. Fifteen
 * steps in this cycle: seven are `21`, four are `11`, and four are `0` with
 * start and end set to the same instant — a placeholder written when the row
 * was created, not a real window.
 *
 * The original's rule, kept here:
 *
 * - **21** — closed, whatever the dates say. This is the portal marking a step
 *   finished, and it overrides a range that has not elapsed.
 * - **11** — live, so the dates decide: upcoming, open, or closed.
 * - **0** with start equal to end — not scheduled yet. Rendering that range
 *   would announce a deadline that does not exist.
 *
 * ## The times are Pakistan wall-clock, and carry no zone
 *
 * `"2026-05-15T00:00:00"` has no offset, so `new Date()` reads it in whatever
 * zone the process happens to be in. These are PHF deadlines set in Pakistan;
 * the first version rendered them converted to UTC and every one came out five
 * hours early — "opens 14 May, 19:00" for a window that opens at midnight on
 * the 15th. A deadline shown five hours early is worse than no deadline.
 *
 * So the components are read as a WALL CLOCK and rebuilt with `Date.UTC`, which
 * preserves the digits exactly. Formatting then pins the zone to UTC, and the
 * page labels the result PKT — which is what the digits have always meant.
 */

export type SchedulePhase = "active" | "upcoming" | "closed" | "pending";

/** Pakistan is UTC+5 year-round; it observes no daylight saving. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type ScheduleStep = {
  id: number;
  order: number;
  title: string;
  detail: string | null;
  phase: SchedulePhase;
  /** Null when the step is not scheduled yet. */
  start: string | null;
  end: string | null;
};

type RawStep = {
  stepId: number;
  sortOrder: number;
  title: string;
  detail?: string;
  statusId?: number;
  statusIdd?: number;
  startDate?: string;
  startH?: number;
  startM?: number;
  endDate?: string;
  endH?: number;
  endM?: number;
  endDated?: string;
};

/**
 * A step with no real window: status 0 and an identical start and end.
 *
 * The portal writes the row's creation timestamp into both when a step has not
 * been scheduled, so the range looks valid and is meaningless.
 */
function isPlaceholder(step: RawStep): boolean {
  if ((step.statusId ?? 0) !== 0 || (step.statusIdd ?? 0) !== 0) return false;
  const start = Date.parse(step.startDate ?? "");
  const end = Date.parse(step.endDate ?? step.endDated ?? "");
  return Number.isFinite(start) && start === end;
}

/**
 * Boundary as an instant whose UTC digits are the Pakistan wall clock.
 *
 * The date and the time arrive in separate fields, and the time inside the date
 * string is not always the real one — `endH`/`endM` are authoritative where
 * present. Everything is parsed textually rather than through `new Date(raw)`,
 * so the process time zone cannot shift the result.
 */
function boundary(step: RawStep, which: "start" | "end"): string | null {
  const raw =
    which === "start" ? step.startDate : (step.endDated ?? step.endDate);
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(raw);
  if (!match) return null;

  const [, year, month, day, rawHour, rawMinute] = match;

  const hourField = which === "start" ? step.startH : step.endH;
  const minuteField = which === "start" ? step.startM : step.endM;

  const hour = Number.isFinite(Number(hourField))
    ? Number(hourField)
    : Number(rawHour ?? 0);
  const minute = Number.isFinite(Number(minuteField))
    ? Number(minuteField)
    : Number(rawMinute ?? 0);

  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), hour, minute)
  ).toISOString();
}

/**
 * "Now", expressed the same way the boundaries are.
 *
 * Comparing a real instant against a wall-clock-as-UTC boundary would be five
 * hours out in the other direction, so the current Pakistan wall clock is
 * shifted into the same frame before anything is compared.
 */
function nowInFrame(): Date {
  const now = new Date();
  return new Date(now.getTime() + PKT_OFFSET_MS);
}

function phaseOf(step: RawStep, now: Date): SchedulePhase {
  if (isPlaceholder(step)) return "pending";

  const status = step.statusId ?? step.statusIdd ?? 0;
  const start = boundary(step, "start");
  const end = boundary(step, "end");

  // 21 is the portal saying "finished", and it wins over the dates.
  if (status === 21) return "closed";

  if (status === 11) {
    if (end && now > new Date(end)) return "closed";
    if (start && now < new Date(start)) return "upcoming";
    return "active";
  }

  if (status === 0) return "pending";

  if (end && now > new Date(end)) return "closed";
  if (start && now < new Date(start)) return "upcoming";
  if (start && end) return "active";
  return "pending";
}

/**
 * The RAW steps are cached, not the computed ones.
 *
 * Phases depend on the clock, so caching them would leave a step reading
 * "Open now" hours after it closed. The file is read once; the phase is
 * decided on every call.
 */
let rawCache: RawStep[] | null = null;

export async function loadSchedule(): Promise<ScheduleStep[]> {
  if (!rawCache) {
    const raw = await readFile(
      join(process.cwd(), "public", "data", "induction21_schedule.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    rawCache = Array.isArray(parsed)
      ? parsed
      : (parsed.Table ?? parsed.steps ?? Object.values(parsed)[0]);
  }

  const now = nowInFrame();

  return (rawCache ?? [])
    .map((step) => ({
      id: step.stepId,
      order: step.sortOrder,
      title: step.title?.trim() ?? "",
      // "PHF" and the like — the body responsible, not a description.
      detail: step.detail?.trim() || null,
      phase: phaseOf(step, now),
      start: isPlaceholder(step) ? null : boundary(step, "start"),
      end: isPlaceholder(step) ? null : boundary(step, "end"),
    }))
    .sort((a, b) => a.order - b.order);
}
