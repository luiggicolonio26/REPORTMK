import { parseLoose } from "./numbers.js";

/*
 * Two free-form lists the manager fills in: what sold, and who bought it.
 * Both are stored as rows so a blank row never reaches the report.
 */

export const emptyRow = () => ({ name: "", value: "" });

const clean = (rows, max) =>
  (rows ?? [])
    .map((r) => ({ name: String(r?.name ?? "").trim().slice(0, 40), value: parseLoose(r?.value) }))
    .filter((r) => r.name && r.value !== null && r.value >= 0)
    .slice(0, max);

/** Best sellers, ordered by units and given a share of the day's units. */
export function bestSellers(rows, totalUnits = null) {
  const items = clean(rows, 8).sort((a, b) => b.value - a.value);
  const base = totalUnits && totalUnits > 0 ? totalUnits : null;
  return items.map((r) => ({
    name: r.name,
    units: r.value,
    share: base ? (r.value / base) * 100 : null,
  }));
}

/**
 * Customer nationalities as percentages. The total is reported back so the
 * form can flag a set that does not add up — a mix summing to 140% is a typing
 * slip, and silently reporting it would put a wrong figure in front of the
 * area manager.
 */
export function customerMix(rows) {
  const items = clean(rows, 10).sort((a, b) => b.value - a.value);
  const total = items.reduce((sum, r) => sum + r.value, 0);
  return {
    items: items.map((r) => ({ name: r.name, pct: r.value })),
    total,
    /* Rounding across several entries can legitimately land a point either way. */
    balanced: items.length === 0 || Math.abs(total - 100) <= 2,
  };
}
