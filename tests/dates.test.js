import { describe, expect, it, afterEach, vi } from "vitest";
import { ADD, KEY, PARSE, dow, human, isDateKey, lastYear, todayKey } from "../src/lib/dates.js";

describe("date keys", () => {
  it("round-trips a key through PARSE/KEY", () => {
    expect(KEY(PARSE("2025-09-04"))).toBe("2025-09-04");
    expect(KEY(PARSE("2024-02-29"))).toBe("2024-02-29");
  });

  it("uses the viewer's own day, not UTC's", () => {
    // 00:30 in Amsterdam on 5 Sept is still 4 Sept in UTC — toISOString would
    // have reported the wrong day for anyone east of Greenwich after midnight.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-09-04T23:30:00Z"));
    const local = new Date();
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    expect(todayKey()).toBe(expected);
  });

  afterEach(() => vi.useRealTimers());

  it("rejects rubbish instead of throwing later", () => {
    expect(isDateKey("")).toBe(false);
    expect(isDateKey("2025-13-01")).toBe(false);
    expect(isDateKey("2025-02-30")).toBe(false);
    expect(isDateKey("04/09/2025")).toBe(false);
    expect(isDateKey("2025-09-04")).toBe(true);
  });

  it("survives an invalid date without throwing", () => {
    const bad = PARSE("");
    expect(dow(bad)).toBe("—");
    expect(human(bad)).toBe("—");
  });

  it("keeps the weekday when stepping across a DST change", () => {
    // 26 Oct 2025 is the European clock change.
    expect(dow(ADD(PARSE("2025-10-25"), 1))).toBe("Sunday");
    expect(KEY(ADD(PARSE("2025-10-25"), 1))).toBe("2025-10-26");
  });

  it("picks the right comparison day for each basis", () => {
    const d = PARSE("2025-09-04"); // Thursday
    expect(KEY(lastYear(d, "weekday"))).toBe("2024-09-05");
    expect(dow(lastYear(d, "weekday"))).toBe("Thursday");
    expect(KEY(lastYear(d, "date"))).toBe("2024-09-04");
    expect(dow(lastYear(d, "date"))).toBe("Wednesday");
  });
});
