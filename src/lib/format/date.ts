/**
 * Deterministic date formatting.
 *
 * `toLocaleDateString()` with no arguments resolves the locale and time zone
 * from the environment, which differs between the Node server and the browser.
 * That produces a React hydration mismatch — observed as the server rendering
 * "8/9/2026" and the client "09/08/2026" for the same instant.
 *
 * Both arguments are pinned. UTC is used deliberately: a merit list or an
 * approval timestamp should read the same for every viewer, and this product's
 * users span at least one time zone boundary from its data source.
 *
 * The format is also unambiguous by design — "9 Aug 2026" cannot be misread the
 * way a numeric 8/9 can.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FORMAT.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${DATE_TIME_FORMAT.format(date)} UTC`;
}
