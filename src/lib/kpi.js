/** "" / null / rubbish -> null. Everything else -> a finite number (0 included). */
export const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const f = Number(s);
  return Number.isFinite(f) ? f : null;
};

/** a / b, null-safe. b === 0 is undefined, not zero. */
export const ratio = (a, b) => (a === null || b === null || b === 0 ? null : a / b);

/** Relative change of a against b, in percent. */
export const pctChange = (a, b) => (a === null || b === null || b === 0 ? null : ((a - b) / b) * 100);

/** Difference in percentage points — the right unit for a conversion gap. */
export const ppDiff = (a, b) => (a === null || b === null ? null : a - b);

export function kpi(src) {
  const sales = num(src.sales);
  const traffic = num(src.traffic);
  const tx = num(src.transactions);
  const units = num(src.units);
  const conv = ratio(tx, traffic);
  return {
    sales,
    traffic,
    tx,
    units,
    conv: conv === null ? null : conv * 100, // %
    atv: ratio(sales, tx), // average transaction value
    aur: ratio(sales, units), // average unit retail
    upt: ratio(units, tx), // units per transaction
  };
}

/** Below this many transactions a single-digit gap says nothing. */
export const NOISE_TX = 30;

export const isNoisy = (deltaSales, tx) =>
  deltaSales !== null && Math.abs(deltaSales) < 12 && (tx === null || tx < NOISE_TX);
