import { apiGet, apiSend, ApiError } from "./api.js";

/*
 * Two backends, same interface:
 *  - "cloud": the /api/history route, backed by a Redis-compatible KV store.
 *    Shared across every computer that opens the site.
 *  - "local": localStorage. Works with no configuration, but the history only
 *    exists in that one browser.
 * Writes always hit localStorage as well, so the app keeps working offline.
 */

const PREFIX = "reportmk:day:";
let mode = "local";
let probed = false;

export const storageMode = () => mode;

function localGet(date) {
  try {
    const raw = localStorage.getItem(PREFIX + date);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function localSet(date, data) {
  try {
    localStorage.setItem(PREFIX + date, JSON.stringify(data));
    return true;
  } catch {
    return false; // quota or private mode
  }
}

/**
 * Detect once whether a shared store is configured on the server.
 * A rejected access key leaves `probed` false on purpose: the caller shows the
 * gate and calls this again with a key, and that second call has to reach the
 * server. Marking it probed here would make the retry a no-op, and every
 * password — right or wrong — would appear to work.
 */
export async function initStore() {
  if (probed) return mode;
  try {
    const r = await apiGet("/api/history?probe=1");
    mode = r.configured ? "cloud" : "local";
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e; // ask for the access key
    mode = "local";
  }
  probed = true;
  return mode;
}

export async function loadDay(date) {
  if (mode === "cloud") {
    try {
      const r = await apiGet(`/api/history?date=${encodeURIComponent(date)}`);
      if (r.data) return r.data;
      return null;
    } catch {
      /* fall through to the local copy */
    }
  }
  return localGet(date);
}

export async function saveDay(date, data) {
  const local = localSet(date, data);
  if (mode !== "cloud") {
    if (!local) throw new Error("This browser will not let the app store anything (private mode?).");
    return { where: "local" };
  }
  await apiSend("/api/history", { date, data });
  return { where: "cloud" };
}

/** Bulk import. Existing days are merged, not replaced, so notes and reports survive. */
export async function saveMany(days) {
  if (mode === "cloud") {
    const r = await apiSend("/api/history", { days });
    for (const { date, values } of days) localSet(date, { ...(localGet(date) || {}), ...values });
    return r.saved ?? days.length;
  }
  let ok = 0;
  for (const { date, values } of days) {
    if (localSet(date, { ...(localGet(date) || {}), ...values })) ok++;
  }
  if (!ok && days.length) throw new Error("This browser will not let the app store anything (private mode?).");
  return ok;
}
