/** Files under api/_lib are helpers, not routes — Vercel ignores `_`-prefixed paths. */

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function methodGuard(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed.join(", "));
  json(res, 405, { error: `Method ${req.method} not allowed`, code: "method_not_allowed" });
  return false;
}

/**
 * Optional shared-secret gate. Set APP_PASSWORD in the Vercel project and the
 * routes stop answering to anyone who does not send it — without it, a public
 * deployment lets any visitor spend your Anthropic credit.
 */
export function authorised(req, res) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  const given = req.headers["x-app-key"];
  if (typeof given === "string" && timingSafeEqual(given, expected)) return true;
  json(res, 401, { error: "Access key required", code: "unauthorised" });
  return false;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Vercel parses JSON bodies already; this covers `vercel dev` edge cases and raw strings. */
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

export const isDateKey = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  // Round-trip: "2025-02-30" parses to 2 March in some engines rather than failing.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
