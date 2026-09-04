/* Thin wrapper over the serverless routes. The Anthropic key lives on the
   server; the browser never sees it. */

const KEY_STORE = "reportmk:apikey";

/* Private-mode browsers throw on localStorage. Without this fallback the key
   would never stick and the access gate would reappear on every request. */
let memoryKey = "";

export const getAppKey = () => {
  try {
    return localStorage.getItem(KEY_STORE) || memoryKey;
  } catch {
    return memoryKey;
  }
};

export const setAppKey = (v) => {
  memoryKey = v || "";
  try {
    if (v) localStorage.setItem(KEY_STORE, v);
    else localStorage.removeItem(KEY_STORE);
  } catch { /* not persisted, but it lasts the session */ }
};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function headers(extra = {}) {
  const k = getAppKey();
  return { ...extra, ...(k ? { "x-app-key": k } : {}) };
}

async function fail(res) {
  let body = {};
  try {
    body = await res.json();
  } catch { /* not JSON */ }
  return new ApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
}

export async function apiGet(path) {
  const res = await fetch(path, { headers: headers() });
  if (!res.ok) throw await fail(res);
  return res.json();
}

export async function apiSend(path, body, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await fail(res);
  return res.json();
}

/** Streams the report text back chunk by chunk so a slow model never trips the
    function timeout and the user sees the report being written. */
export async function streamReport(facts, onChunk, signal) {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ facts }),
    signal,
  });
  if (!res.ok) throw await fail(res);
  if (!res.body) return (await res.text()).trim();

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    out += chunk;
    onChunk?.(out);
  }
  return out.trim();
}

export const weatherBySearch = (date) => apiSend("/api/weather-search", { date });
