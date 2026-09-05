import { PARSE, isDateKey } from "./dates.js";

/*
 * Where the day sits in the year, for a premium outerwear store. This is
 * context for reading the product mix — never proof of anything. It is
 * computed here rather than left to the model so the season can never
 * disagree with the date on the form.
 */

const METEOROLOGICAL = [
  { start: 3, name: "spring" },
  { start: 6, name: "summer" },
  { start: 9, name: "autumn" },
  { start: 12, name: "winter" },
];

/* The outerwear selling year, which does not line up with the calendar one. */
const PHASE = {
  1: "winter clearance, heavy outerwear on markdown",
  2: "late winter clearance, the first spring pieces arriving",
  3: "spring transition, lighter jackets taking over from heavy coats",
  4: "spring, transitional and lightweight outerwear",
  5: "late spring, lightest weights only; heavy coats effectively out of season",
  6: "summer, the lowest outerwear demand of the year",
  7: "summer sale, clearance traffic rather than season buying",
  8: "late summer sale, with the first autumn/winter deliveries landing",
  9: "early autumn, the autumn/winter build starting and the first cold-weather buying",
  10: "autumn, the main coat-buying period",
  11: "late autumn, the autumn/winter peak with gifting beginning",
  12: "winter peak, gifting and cold-weather buying together",
};

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/**
 * The nearest meteorological season boundary, and which season it starts.
 * The boundary's own season matters: seven days before 1 September the day is
 * still in summer, but the season arriving — the one worth naming — is autumn.
 */
function nearestBoundary(d) {
  const y = d.getUTCFullYear();
  const bounds = [];
  for (const off of [-1, 0, 1]) {
    for (const { start, name } of METEOROLOGICAL) {
      bounds.push({ at: Date.UTC(y + off, start - 1, 1, 12), name });
    }
  }
  return bounds
    .map((b) => ({ offset: Math.round((d.getTime() - b.at) / 86400000), name: b.name }))
    .reduce((best, v) => (Math.abs(v.offset) < Math.abs(best.offset) ? v : best));
}

export function season(date) {
  const d = typeof date === "string" ? (isDateKey(date) ? PARSE(date) : null) : date;
  if (!d || Number.isNaN(d.getTime())) return null;

  const month = d.getUTCMonth() + 1;
  const name = month === 12 || month <= 2 ? "winter"
    : month <= 5 ? "spring"
    : month <= 8 ? "summer"
    : "autumn";

  const { offset, name: arriving } = nearestBoundary(d);
  /* Within a fortnight of a boundary the mix is genuinely in flux, and that is
     worth saying; outside it, calling every day a "transition" is noise. */
  const transition = Math.abs(offset) > 14
    ? null
    : offset >= 0
      ? `${offset === 0 ? "the first day of" : `${offset} days into`} ${arriving}, still turning over from the season before`
      : `${-offset} days before ${arriving} begins, the mix already shifting`;

  return { name, month, monthName: MONTHS[month - 1], phase: PHASE[month], transition };
}
