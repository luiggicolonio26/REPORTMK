import { isDateKey } from "./dates.js";
import { parseLoose } from "./numbers.js";

const FIELDS = ["sales", "traffic", "transactions", "units"];

/**
 * One line per day: date; net sales; traffic; transactions; units.
 * Tab wins over semicolon wins over comma, so an Excel paste and a
 * semicolon CSV both work and comma decimals survive in the first two.
 */
export function parseHistory(text) {
  const days = [];
  const skipped = [];
  const seen = new Set();

  String(text ?? "")
    .split(/\r?\n/)
    .forEach((line, i) => {
      const raw = line.trim();
      if (!raw) return;

      const delim = raw.includes("\t") ? "\t" : raw.includes(";") ? ";" : ",";
      const cells = raw.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
      const day = (cells[0] || "").slice(0, 10);

      if (!isDateKey(day)) {
        skipped.push({ line: i + 1, text: raw, reason: "no valid YYYY-MM-DD date in the first column" });
        return;
      }
      if (seen.has(day)) {
        skipped.push({ line: i + 1, text: raw, reason: `${day} appears more than once` });
        return;
      }

      const values = {};
      let any = false;
      FIELDS.forEach((field, idx) => {
        const v = parseLoose(cells[idx + 1]);
        values[field] = v === null ? "" : String(v);
        if (v !== null) any = true;
      });

      if (!any) {
        skipped.push({ line: i + 1, text: raw, reason: "no figures on the line" });
        return;
      }
      seen.add(day);
      days.push({ date: day, values });
    });

  return { days, skipped };
}
