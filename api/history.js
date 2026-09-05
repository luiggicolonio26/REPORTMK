import { cmd, DAY, INDEX, kvConfigured, pipeline } from "./_lib/kv.js";
import { authorised, isDateKey, json, methodGuard, readJson } from "./_lib/http.js";

const MAX_BULK = 400;

const parse = (raw) => {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};

/** Name/value rows, capped in both length and count. */
const rows = (list, max, nameLen) =>
  Array.isArray(list)
    ? list
        .slice(0, max)
        .map((r) => ({
          name: String(r?.name ?? "").slice(0, nameLen),
          value: String(r?.value ?? "").slice(0, 12),
        }))
        .filter((r) => r.name || r.value)
    : [];

/** Only the fields the app actually stores, so a day cannot be used as free storage. */
function clean(data) {
  if (!data || typeof data !== "object") return null;
  const str = (v, max) => (v === null || v === undefined ? "" : String(v).slice(0, max));
  return {
    sales: str(data.sales, 24),
    traffic: str(data.traffic, 24),
    transactions: str(data.transactions, 24),
    units: str(data.units, 24),
    target: str(data.target, 24),
    weather: {
      desc: str(data.weather?.desc, 60),
      tmax: str(data.weather?.tmax, 12),
      rain: str(data.weather?.rain, 12),
    },
    chips: Array.isArray(data.chips) ? data.chips.slice(0, 20).map((c) => str(c, 60)) : [],
    sellers: rows(data.sellers, 8, 40),
    mix: rows(data.mix, 10, 40),
    notes: str(data.notes, 4000),
    report: str(data.report, 8000),
    savedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  if (!authorised(req, res)) return;

  const configured = kvConfigured();

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.has("probe")) return json(res, 200, { configured });
    if (!configured) return json(res, 200, { configured, data: null, dates: [] });

    try {
      if (url.searchParams.has("list")) {
        const dates = (await cmd("SMEMBERS", INDEX)) || [];
        return json(res, 200, { configured, dates: [...dates].sort() });
      }
      const date = url.searchParams.get("date");
      if (!isDateKey(date)) return json(res, 400, { error: "Invalid date", code: "bad_request" });
      return json(res, 200, { configured, data: parse(await cmd("GET", DAY(date))) });
    } catch (e) {
      return json(res, 502, { error: `History store unreachable: ${e.message}`, code: "kv_error" });
    }
  }

  if (!configured) {
    return json(res, 501, {
      error: "No shared history store is configured on this deployment.",
      code: "not_configured",
      configured,
    });
  }

  const body = await readJson(req);

  try {
    // Single day — a full replace of what the form holds.
    if (body.date) {
      if (!isDateKey(body.date)) return json(res, 400, { error: "Invalid date", code: "bad_request" });
      const data = clean(body.data);
      if (!data) return json(res, 400, { error: "Nothing to save", code: "bad_request" });
      await pipeline([
        ["SET", DAY(body.date), JSON.stringify(data)],
        ["SADD", INDEX, body.date],
      ]);
      return json(res, 200, { configured, saved: 1 });
    }

    // Bulk import — merged into whatever is already stored for those days.
    if (Array.isArray(body.days)) {
      const days = body.days
        .filter((d) => d && isDateKey(d.date) && d.values && typeof d.values === "object")
        .slice(0, MAX_BULK);
      if (!days.length) return json(res, 400, { error: "No valid rows", code: "bad_request" });

      const existing = await pipeline(days.map((d) => ["GET", DAY(d.date)]));
      const writes = days.map((d, i) => {
        const prev = parse(existing[i]) || {};
        const merged = clean({
          ...prev, ...d.values,
          weather: prev.weather, chips: prev.chips, sellers: prev.sellers, mix: prev.mix,
        });
        return ["SET", DAY(d.date), JSON.stringify(merged)];
      });
      await pipeline([...writes, ["SADD", INDEX, ...days.map((d) => d.date)]]);
      return json(res, 200, { configured, saved: days.length });
    }

    return json(res, 400, { error: "Nothing to save", code: "bad_request" });
  } catch (e) {
    return json(res, 502, { error: `History store unreachable: ${e.message}`, code: "kv_error" });
  }
}
