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

describe("what improved and what did not", () => {
  it("sorts the KPIs into ahead and behind by arithmetic", () => {
    const a = analyse({
      date: "2026-09-04", basis: "weekday",
      today: { sales: "5000", target: "", traffic: "380", transactions: "50", units: "80" },
      ly:    { sales: "4000", traffic: "400", transactions: "44", units: "70" },
    });
    // conversion 13.2% vs 11.0%, traffic 380 vs 400
    expect(a.ahead.join(" ")).toMatch(/conversion \+2\.2pp/);
    expect(a.ahead.join(" ")).toMatch(/net sales \+25\.0%/);
    expect(a.behind.join(" ")).toMatch(/traffic -5\.0%/);
  });

  it("counts a flat KPI as neither, so praise stays meaningful", () => {
    const same = { sales: "4000", traffic: "400", transactions: "44", units: "70" };
    const a = analyse({ date: "2026-09-04", basis: "weekday", today: { ...same, target: "" }, ly: same });
    expect(a.ahead).toEqual([]);
    expect(a.behind).toEqual([]);
  });
});

describe("the brief the model reads", () => {
  const base = {
    date: "2026-10-15", basis: "weekday",
    today: { sales: "8000", target: "", traffic: "500", transactions: "60", units: "100" },
    ly: { sales: "7000", traffic: "520", transactions: "55", units: "90" },
  };
  const ctx = { basis: "weekday", wToday: {}, wLy: {}, chips: [], notes: "" };

  it("carries the season, the sellers and the customer mix", () => {
    const facts = buildFacts(analyse(base), {
      ...ctx,
      sellers: [{ name: "Parkas", value: "25" }, { name: "Down jackets", value: "15" }],
      mix: [{ name: "German", value: "50" }, { name: "Dutch", value: "30" }, { name: "Belgian", value: "20" }],
    });
    expect(facts).toMatch(/SEASON: autumn, October/);
    expect(facts).toMatch(/main coat-buying period/);
    expect(facts).toMatch(/BEST SELLERS TODAY: Parkas 25 units \(25\.0% of units\)/);
    expect(facts).toMatch(/CUSTOMER MIX TODAY: German 50\.0%/);
    expect(facts).toMatch(/AHEAD OF LAST YEAR: .*conversion/);
  });

  it("says the sections are not recorded rather than leaving them blank", () => {
    const facts = buildFacts(analyse(base), ctx);
    expect(facts).toMatch(/BEST SELLERS TODAY: not recorded/);
    expect(facts).toMatch(/CUSTOMER MIX TODAY: not recorded/);
  });

  it("warns the model when the nationality split does not add up", () => {
    const facts = buildFacts(analyse(base), {
      ...ctx,
      mix: [{ name: "German", value: "80" }, { name: "Dutch", value: "60" }],
    });
    expect(facts).toMatch(/WARNING: these add up to 140\.0%/);
  });
});
