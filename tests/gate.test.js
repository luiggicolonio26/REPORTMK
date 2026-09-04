import { beforeEach, describe, expect, it, vi } from "vitest";

/* The access gate lives across three modules, so it is exercised here with a
   stubbed fetch rather than by unit-testing each piece in isolation. */

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const PASSWORD = "the-real-key";
let calls = [];

function server() {
  return vi.fn(async (url, opts = {}) => {
    const key = opts.headers?.["x-app-key"];
    calls.push({ url, key });
    if (key !== PASSWORD) {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: "Access key required", code: "unauthorised" }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ configured: false }) };
  });
}

async function freshModules() {
  vi.resetModules();
  return {
    store: await import("../src/lib/store.js"),
    api: await import("../src/lib/api.js"),
  };
}

describe("access gate", () => {
  beforeEach(() => {
    store.clear();
    calls = [];
    globalThis.fetch = server();
  });

  it("reports a locked deployment with a 401", async () => {
    const { store: s, api } = await freshModules();
    await expect(s.initStore()).rejects.toMatchObject({ status: 401 });
    expect(api.getAppKey()).toBe("");
  });

  it("rejects a wrong key on the retry", async () => {
    // The bug this guards: the first probe marked the store as already probed,
    // so the retry short-circuited and every password appeared to work.
    const { store: s, api } = await freshModules();
    await expect(s.initStore()).rejects.toMatchObject({ status: 401 });

    api.setAppKey("wrong-password");
    await expect(s.initStore()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(2);
    expect(calls[1].key).toBe("wrong-password");
  });

  it("lets the right key through and stops probing after that", async () => {
    const { store: s, api } = await freshModules();
    await expect(s.initStore()).rejects.toMatchObject({ status: 401 });

    api.setAppKey(PASSWORD);
    expect(await s.initStore()).toBe("local");
    expect(await s.initStore()).toBe("local");
    expect(calls).toHaveLength(2); // the success is cached, not re-probed
  });

  it("keeps the key for the session when localStorage is unavailable", async () => {
    const { api } = await freshModules();
    const broken = () => { throw new Error("private mode"); };
    const saved = globalThis.localStorage;
    globalThis.localStorage = { getItem: broken, setItem: broken, removeItem: broken };
    api.setAppKey(PASSWORD);
    expect(api.getAppKey()).toBe(PASSWORD);
    globalThis.localStorage = saved;
  });
});
