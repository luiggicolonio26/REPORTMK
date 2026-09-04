/**
 * Parse a number the way it comes out of a European till report or an Excel
 * paste: "4.820,50", "4,820.50", "€ 4820", "4820" all mean the same thing.
 * Returns null when there is no number in there.
 */
export function parseLoose(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/[€\s ']/g, "");
  if (s === "") return null;

  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  if (!/^[-+]?[\d.,]+$/.test(s)) return null;

  const dot = s.lastIndexOf(".");
  const comma = s.lastIndexOf(",");

  if (dot !== -1 && comma !== -1) {
    // whichever separator comes last is the decimal one
    const dec = dot > comma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (comma !== -1) {
    // a lone comma: thousands only if it groups in threes ("1,234" / "1,234,567")
    s = /^[-+]?\d{1,3}(,\d{3})+$/.test(s) ? s.split(",").join("") : s.replace(",", ".");
  } else if (dot !== -1) {
    s = /^[-+]?\d{1,3}(\.\d{3})+$/.test(s) ? s.split(".").join("") : s;
  }

  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}
