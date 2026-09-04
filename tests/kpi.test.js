import { describe, expect, it } from "vitest";
import { isNoisy, kpi, num, pctChange, ppDiff, ratio } from "../src/lib/kpi.js";

describe("kpi maths", () => {
  it("treats zero as a figure, not as missing", () => {
    expect(num("0")).toBe(0);
    expect(num("")).toBe(null);
    expect(num("abc")).toBe(null);
    // A day with no transactions converts at 0%, it is not "unknown".
    expect(kpi({ sales: "0", traffic: "300", transactions: "0", units: "0" }).conv).toBe(0);
  });

  it("never divides by zero", () => {
    expect(ratio(5, 0)).toBe(null);
    expect(pctChange(10, 0)).toBe(null);
    expect(kpi({ sales: "100", traffic: "0", transactions: "0", units: "0" }).conv).toBe(null);
    expect(kpi({ sales: "100", traffic: "10", transactions: "0", units: "0" }).atv).toBe(null);
  });

  it("computes the standard retail ratios", () => {
    const k = kpi({ sales: "5000", traffic: "400", transactions: "50", units: "80" });
    expect(k.conv).toBeCloseTo(12.5);
    expect(k.atv).toBeCloseTo(100);
    expect(k.aur).toBeCloseTo(62.5);
    expect(k.upt).toBeCloseTo(1.6);
  });

  it("reports a conversion gap in percentage points", () => {
    expect(ppDiff(12.5, 10)).toBeCloseTo(2.5);
    expect(ppDiff(null, 10)).toBe(null);
  });

  it("flags a low-volume day as noise", () => {
    expect(isNoisy(-5, 12)).toBe(true);
    expect(isNoisy(-5, 120)).toBe(false);
    expect(isNoisy(-40, 12)).toBe(false);
    expect(isNoisy(null, 12)).toBe(false);
  });
});
