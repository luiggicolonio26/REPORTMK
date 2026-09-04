import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5";

/* Server-side fallback: if a safety classifier declines the request, the API
   re-runs it on a fallback model inside the same call instead of returning
   nothing. */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

let client;

export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error(
      "ANTHROPIC_API_KEY is not set on the server. Add it in the Vercel project settings and redeploy."
    );
    e.code = "no_api_key";
    e.status = 503;
    throw e;
  }
  client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return client;
}

export const textOf = (message) =>
  (message?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
