import { describe, expect, it } from "vitest";
import { parseHistory } from "../src/lib/importer.js";
import { parseLoose } from "../src/lib/numbers.js";

describe("number parsing", () => {
  it("reads the formats a till report actually produces", () => {
    expect(parseLoose("4820")).toBe(4820);
    expect(parseLoose("4.820,50")).toBe(4820.5);
    expect(parseLoose("4,820.50")).toBe(4820.5);
    expect(parseLoose("€ 4 820")).toBe(4820);
    expect(parseLoose("1,5")).toBe(1.5);
    expect(parseLoose("1,234")).toBe(1234);
    expect(parseLoose("")).toBe(null);
    expect(parseLoose("n/a")).toBe(null);
  });
});

describe("history import", () => {
  it("accepts semicolons, tabs and commas", () => {
    const { days } = parseHistory("2025-09-05;4820;310;41;68\n2025-09-06\t7130\t465\t62\t104\n2025-09-07,1000,50,5,9");
    expect(days.map((d) => d.date)).toEqual(["2025-09-05", "2025-09-06", "2025-09-07"]);
    expect(days[0].values).toEqual({ sales: "4820", traffic: "310", transactions: "41", units: "68" });
  });

  it("keeps European decimals when the delimiter is a semicolon", () => {
    const { days } = parseHistory("2025-09-05;4.820,50;310;41;68");
    expect(days[0].values.sales).toBe("4820.5");
  });

  it("reports bad lines instead of silently dropping them", () => {
    const { days, skipped } = parseHistory("date;sales\n05/09/2025;100\n2025-09-05;4820;310;41;68\n2025-09-05;1;1;1;1");
    expect(days).toHaveLength(1);
    expect(skipped.map((s) => s.line)).toEqual([1, 2, 4]);
    expect(skipped[2].reason).toMatch(/more than once/);
  });

  it("skips a dated line that carries no figures", () => {
    const { days, skipped } = parseHistory("2025-09-05;;;;");
    expect(days).toHaveLength(0);
    expect(skipped[0].reason).toMatch(/no figures/);
  });
});
