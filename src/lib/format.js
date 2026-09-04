export const f1 = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(1));

export const f0 = (v) =>
  v === null || v === undefined ? "—" : Math.round(Number(v)).toLocaleString("en-GB");

export const money = (v) =>
  v === null || v === undefined
    ? "—"
    : "€" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });

export const signed = (v, digits = 1) =>
  v === null || v === undefined ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(digits);
