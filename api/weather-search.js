import { pickProvider } from "./_lib/provider.js";
import { authorised, isDateKey, json, methodGuard, readJson } from "./_lib/http.js";

/**
 * Last-resort weather lookup for days open-meteo has no record of. It needs a
 * provider with a built-in web search tool, which today means Anthropic; on
 * Groq or Mistral the app falls back to typing the weather in by hand.
 */
export default async function handler(req, res) {
  if (!methodGuard(req, res, ["POST"])) return;
  if (!authorised(req, res)) return;

  const { date } = await readJson(req);
  if (!isDateKey(date)) return json(res, 400, { error: "Invalid date", code: "bad_request" });

  let provider;
  try {
    provider = pickProvider();
  } catch (e) {
    return json(res, e.status ?? 500, { error: e.message, code: e.code ?? "server_error" });
  }

  if (!provider.webSearch) {
    return json(res, 501, {
      error: `${provider.label} cannot search the web, so the weather has to be typed in.`,
      code: "no_web_search",
    });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: provider.apiKey, maxRetries: 1 });
    const message = await client.beta.messages.create({
      model: provider.model,
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
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (message.stop_reason === "refusal") {
      return json(res, 422, { error: "No weather found for that day", code: "not_found" });
    }

    const text = (message.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "");
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
