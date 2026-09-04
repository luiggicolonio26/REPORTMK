/**
 * Redis-over-HTTP (Upstash / Vercel KV). No dependency — it is one POST.
 * Configured by either env pair; both are set by the Vercel Marketplace
 * Upstash integration.
 */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const kvConfigured = () => Boolean(URL_ && TOKEN);

export const DAY = (date) => `reportmk:day:${date}`;
export const INDEX = "reportmk:days";

async function post(path, body) {
  const res = await fetch(`${URL_.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`KV ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** One command, e.g. cmd("GET", key). Returns the raw `result`. */
export async function cmd(...args) {
  const out = await post("", args.map(String));
  return out?.result ?? null;
}

/** Several commands in one round trip. Returns an array of results. */
export async function pipeline(commands) {
  if (!commands.length) return [];
  const out = await post("/pipeline", commands.map((c) => c.map(String)));
  return (Array.isArray(out) ? out : []).map((entry) => {
    if (entry?.error) throw new Error(`KV: ${entry.error}`);
    return entry?.result ?? null;
  });
}
