import { anthropic, MODEL, FALLBACK, textOf } from "./_lib/anthropic.js";
import { authorised, isDateKey, json, methodGuard, readJson } from "./_lib/http.js";

/** Last-resort weather lookup for days the open-meteo endpoints have no record of. */
export default async function handler(req, res) {
  if (!methodGuard(req, res, ["POST"])) return;
  if (!authorised(req, res)) return;

  const { date } = await readJson(req);
  if (!isDateKey(date)) return json(res, 400, { error: "Invalid date", code: "bad_request" });

  let client;
  try {
    client = anthropic();
  } catch (e) {
    return json(res, e.status ?? 500, { error: e.message, code: e.code ?? "server_error" });
  }

  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      messages: [
        {
          role: "user",
          content:
            `Search for the recorded weather in Roermond, Netherlands on ${date}. ` +
            `Reply with a JSON object only, no prose and no markdown fences: ` +
            `{"desc":"short description","tmax":number,"rain":number}. ` +
            `tmax is the maximum temperature in Celsius, rain is total precipitation in mm. ` +
            `If you cannot find the day, reply {"desc":"","tmax":null,"rain":null}.`,
        },
      ],
      ...FALLBACK,
    });

    if (message.stop_reason === "refusal") {
      return json(res, 422, { error: "No weather found for that day", code: "not_found" });
    }

    const text = textOf(message).replace(/```json|```/g, "");
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return json(res, 502, { error: "No weather found for that day", code: "not_found" });

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return json(res, 502, { error: "No weather found for that day", code: "not_found" });
    }

    const numeric = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const desc = typeof parsed.desc === "string" ? parsed.desc.slice(0, 60) : "";
    const tmax = numeric(parsed.tmax);
    const rain = numeric(parsed.rain);
    if (!desc && tmax === null) {
      return json(res, 404, { error: "No weather found for that day", code: "not_found" });
    }

    json(res, 200, { desc, tmax, rain, source: "web-search" });
  } catch (e) {
    const detail = e?.error?.error?.message || e?.message || "Unknown error";
    json(res, 502, { error: `Weather lookup failed: ${detail}`, code: "upstream_error" });
  }
}
