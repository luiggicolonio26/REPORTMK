import { describe, expect, it } from "vitest";
import { season } from "../src/lib/season.js";

describe("season context", () => {
  it("names the meteorological season", () => {
    expect(season("2026-01-15").name).toBe("winter");
    expect(season("2026-04-15").name).toBe("spring");
    expect(season("2026-07-15").name).toBe("summer");
    expect(season("2026-10-15").name).toBe("autumn");
    expect(season("2026-12-01").name).toBe("winter");
  });

  it("describes where the day sits in the outerwear year", () => {
    expect(season("2026-10-15").phase).toMatch(/coat-buying/);
    expect(season("2026-07-15").phase).toMatch(/clearance/);
    expect(season("2026-01-15").phase).toMatch(/markdown/);
  });

  it("flags a changeover only when the day is near one", () => {
    expect(season("2026-09-04").transition).toMatch(/into autumn/);
    expect(season("2026-08-25").transition).toMatch(/before autumn/);
    // mid-season is not a transition, or every day would be one
    expect(season("2026-10-15").transition).toBe(null);
  });

  it("handles the December boundary across the year end", () => {
    expect(season("2026-12-01").transition).toMatch(/first day of winter/);
    expect(season("2026-11-25").transition).toMatch(/before winter/);
  });

  it("returns nothing for an invalid date rather than throwing", () => {
    expect(season("")).toBe(null);
    expect(season("nonsense")).toBe(null);
  });
});
