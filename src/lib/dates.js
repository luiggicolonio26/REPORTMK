/* Every date in the app is anchored at 12:00 UTC, so day arithmetic never
   trips over DST or a timezone that is behind/ahead of the store. */

const pad = (v) => String(v).padStart(2, "0");

export const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Date -> "YYYY-MM-DD" using UTC parts (never toISOString on a local-midnight Date). */
export const KEY = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** "YYYY-MM-DD" -> Date at noon UTC. Invalid input yields an Invalid Date. */
export const PARSE = (s) => new Date(`${s}T12:00:00Z`);

/** Today in the *viewer's own* timezone — the store closes locally, not in UTC. */
export const todayKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

/* Round-trips through KEY: some engines quietly roll "2025-02-30" over into
   March instead of rejecting it. */
export const isDateKey = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = PARSE(s);
  return !Number.isNaN(d.getTime()) && KEY(d) === s;
};

export const ADD = (d, n) => new Date(d.getTime() + n * 86400000);

export const dow = (d) => (Number.isNaN(d.getTime()) ? "—" : DOW[d.getUTCDay()]);

export const human = (d) =>
  Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Same weekday last year (-364 days) or the same calendar date, one year back. */
export const lastYear = (d, basis) =>
  basis === "weekday"
    ? ADD(d, -364)
    : new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate(), 12));
