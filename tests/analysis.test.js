import { describe, expect, it } from "vitest";
import { analyse, buildFacts } from "../src/lib/analysis.js";

const today = { sales: "5000", target: "5500", traffic: "400", transactions: "50", units: "80" };
const ly = { sales: "4000", traffic: "380", transactions: "44", units: "70" };

describe("analysis", () => {
  it("only warns about a weekday mismatch on a date-to-date comparison", () => {
    expect(analyse({ date: "2025-09-04", basis: "date", today, ly }).mismatch).toBe(true);
    expect(analyse({ date: "2025-09-04", basis: "weekday", today, ly }).mismatch).toBe(false);
  });

  it("survives an empty date instead of crashing", () => {
    const a = analyse({ date: "", basis: "weekday", today, ly });
    expect(a.valid).toBe(false);
    expect(a.hToday).toEqual([]);
  });

  it("builds a facts brief with the real figures in it", () => {
    const a = analyse({ date: "2025-09-04", basis: "weekday", today, ly });
    const facts = buildFacts(a, {
      basis: "weekday",
      wToday: { desc: "rain", tmax: "17", rain: "8" },
      wLy: { desc: "clear", tmax: "24", rain: "0" },
      chips: ["Short staffed"],
      notes: "Delivery late",
    });
    expect(facts).toMatch(/NET SALES vs LY: \+25\.0%/);
    expect(facts).toMatch(/CONVERSION vs LY: \+0\.9 percentage points/);
    expect(facts).toMatch(/target €5,500 \(-9\.1%\)/);
    expect(facts).toMatch(/STORE CONTEXT: Short staffed/);
    expect(facts).toMatch(/NOTES: Delivery late/);
  });

  it("omits the target line when no target was entered", () => {
    const a = analyse({ date: "2025-09-04", basis: "weekday", today: { ...today, target: "" }, ly });
    const facts = buildFacts(a, { basis: "weekday", wToday: {}, wLy: {}, chips: [], notes: "" });
    expect(facts).not.toMatch(/target/);
    expect(facts).toMatch(/NOTES: none/);
  });
});
