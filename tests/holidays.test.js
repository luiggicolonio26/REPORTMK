import { describe, expect, it } from "vitest";
import { easter, holidays } from "../src/lib/holidays.js";
import { KEY } from "../src/lib/dates.js";

describe("holidays", () => {
  it("computes Easter Sunday", () => {
    expect(KEY(easter(2024))).toBe("2024-03-31");
    expect(KEY(easter(2025))).toBe("2025-04-20");
    expect(KEY(easter(2026))).toBe("2026-04-05");
    expect(KEY(easter(2027))).toBe("2027-03-28");
  });

  it("finds the cross-border days that matter to the outlet", () => {
    const names = (k) => holidays(k).map((h) => `${h.region}:${h.name}`);
    expect(names("2025-10-03")).toContain("DE:Tag der Deutschen Einheit");
    expect(names("2025-07-21")).toContain("BE:Nationale feestdag");
    expect(names("2025-04-27")).toContain("NL:Koningsdag");
    expect(names("2025-06-19")).toContain("DE:Fronleichnam"); // Easter + 60
  });

  it("reports every region on a shared date", () => {
    const xmas = holidays("2025-12-25").map((h) => h.region);
    expect(xmas.sort()).toEqual(["BE", "DE", "NL"]);
  });

  it("does not lose one holiday to another on the same date", () => {
    // Easter Monday is a holiday in all three; nothing may overwrite it.
    const easterMonday = holidays("2025-04-21");
    expect(easterMonday).toHaveLength(3);
  });

  it("returns nothing for an invalid date rather than throwing", () => {
    expect(holidays("")).toEqual([]);
    expect(holidays("not-a-date")).toEqual([]);
  });
});
