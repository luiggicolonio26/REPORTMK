import { describe, expect, it } from "vitest";
import { bestSellers, customerMix } from "../src/lib/mix.js";

describe("best sellers", () => {
  it("orders by units and drops the blank rows", () => {
    const out = bestSellers([
      { name: "Down jackets", value: "18" },
      { name: "", value: "99" },
      { name: "Parkas", value: "24" },
      { name: "Gilets", value: "" },
    ]);
    expect(out.map((r) => r.name)).toEqual(["Parkas", "Down jackets"]);
    expect(out[0].units).toBe(24);
  });

  it("works out each line's share of the day's units", () => {
    const out = bestSellers([{ name: "Parkas", value: "24" }], 80);
    expect(out[0].share).toBeCloseTo(30);
  });

  it("leaves the share out when the unit total is unknown", () => {
    expect(bestSellers([{ name: "Parkas", value: "24" }], null)[0].share).toBe(null);
    expect(bestSellers([{ name: "Parkas", value: "24" }], 0)[0].share).toBe(null);
  });
});

describe("customer mix", () => {
  it("orders by share and reports the total", () => {
    const m = customerMix([
      { name: "Dutch", value: "31" },
      { name: "German", value: "46" },
      { name: "Belgian", value: "23" },
    ]);
    expect(m.items.map((r) => r.name)).toEqual(["German", "Dutch", "Belgian"]);
    expect(m.total).toBe(100);
    expect(m.balanced).toBe(true);
  });

  it("flags a mix that does not add up", () => {
    // A typing slip must be caught here, not printed in front of the area manager.
    expect(customerMix([{ name: "German", value: "80" }, { name: "Dutch", value: "60" }]).balanced).toBe(false);
    expect(customerMix([{ name: "German", value: "40" }]).balanced).toBe(false);
  });

  it("tolerates rounding across several entries", () => {
    expect(customerMix([
      { name: "German", value: "33.3" }, { name: "Dutch", value: "33.3" }, { name: "Belgian", value: "33.3" },
    ]).balanced).toBe(true);
  });

  it("treats an empty list as balanced, not as an error", () => {
    expect(customerMix([]).balanced).toBe(true);
    expect(customerMix([{ name: "", value: "" }]).balanced).toBe(true);
  });
});
