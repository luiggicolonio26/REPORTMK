/**
 * One interface over three model providers. Groq and Mistral both speak the
 * OpenAI chat-completions protocol, so they share a code path; Anthropic has
 * its own SDK. Which one runs is decided entirely by environment variables —
 * switching provider is a Vercel setting, not a code change.
 */

export const PROVIDERS = {
  groq: {
    label: "Groq",
    keyVar: "GROQ_API_KEY",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    webSearch: false,
  },
  mistral: {
    label: "Mistral",
    keyVar: "MISTRAL_API_KEY",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    webSearch: false,
  },
  anthropic: {
    label: "Anthropic",
    keyVar: "ANTHROPIC_API_KEY",
    kind: "anthropic",
    baseUrl: null,
    defaultModel: "claude-opus-5",
    webSearch: true,
  },
};

export class ProviderError extends Error {
  constructor(message, status = 503, code = "provider_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const names = () => Object.keys(PROVIDERS);

/**
 * Pure so it can be tested: hand it an env object, get the resolved provider.
 * LLM_PROVIDER decides when set; otherwise exactly one key must be present, so
 * a half-finished migration fails loudly instead of silently billing the old
 * provider.
 */
export function pickProvider(env = process.env) {
  const explicit = String(env.LLM_PROVIDER || "").trim().toLowerCase();

  if (explicit) {
    const spec = PROVIDERS[explicit];
    if (!spec) {
      throw new ProviderError(
        `LLM_PROVIDER is "${explicit}", which is not one of: ${names().join(", ")}.`,
        500,
        "bad_provider"
      );
    }
    if (!env[spec.keyVar]) {
      throw new ProviderError(
        `LLM_PROVIDER is "${explicit}" but ${spec.keyVar} is not set. Add it in the Vercel project settings and redeploy.`,
        503,
        "no_api_key"
      );
    }
    return resolve(explicit, spec, env);
  }

  const configured = names().filter((n) => env[PROVIDERS[n].keyVar]);
  if (configured.length === 0) {
    throw new ProviderError(
      `No model provider is configured. Set one of ${names()
        .map((n) => PROVIDERS[n].keyVar)
        .join(", ")} in the Vercel project settings and redeploy.`,
      503,
      "no_api_key"
    );
  }
  if (configured.length > 1) {
    throw new ProviderError(
      `More than one provider key is set (${configured
        .map((n) => PROVIDERS[n].keyVar)
        .join(", ")}). Set LLM_PROVIDER to say which one to use.`,
      500,
      "ambiguous_provider"
    );
  }
  return resolve(configured[0], PROVIDERS[configured[0]], env);
}

function resolve(name, spec, env) {
  return {
    name,
    label: spec.label,
    kind: spec.kind,
    baseUrl: spec.baseUrl,
    apiKey: env[spec.keyVar],
    model: String(env.LLM_MODEL || "").trim() || spec.defaultModel,
    webSearch: spec.webSearch,
  };
}

/* ---------------- streaming ---------------- */

const TIMEOUT_MS = 55000; // under the function's 60s ceiling

/**
 * Streams the reply, calling onText with each delta. Returns the full text.
 * Throws ProviderError with a message worth showing to the user.
 */
export async function streamChat({ provider, system, user, maxTokens = 1500, onText }) {
  if (provider.kind === "anthropic") return streamAnthropic({ provider, system, user, maxTokens, onText });
  return streamOpenAICompatible({ provider, system, user, maxTokens, onText });
}

async function streamAnthropic({ provider, system, user, maxTokens, onText }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: provider.apiKey, maxRetries: 1 });
  let out = "";
  const stream = client.beta.messages.stream({
    model: provider.model,
    max_tokens: Math.max(maxTokens, 8000), // adaptive thinking shares this budget
    system,
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: user }],
    // If a classifier declines, the API retries on a fallback model in-call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  stream.on("text", (delta) => {
    out += delta;
    onText?.(delta);
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new ProviderError(
      "The model declined to write this report. Check the notes field for anything unusual.",
      422,
      "refusal"
    );
  }
  return out;
}

async function streamOpenAICompatible({ provider, system, user, maxTokens, onText }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        temperature: 0.3, // a trading report should not be inventive
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      clearTimeout(timer);
      throw new ProviderError(await describeFailure(res, provider), res.status, "upstream_error");
    }

    let out = "";
    for await (const payload of sse(res)) {
      if (payload === "[DONE]") break;
      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue; // keep-alive or a partial frame we can ignore
      }
      /* Some gateways report errors mid-stream instead of in the status code. */
      if (chunk.error) {
        throw new ProviderError(chunk.error.message || "The provider reported an error.", 502, "upstream_error");
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        out += delta;
        onText?.(delta);
      }
    }
    return out;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e.name === "AbortError") {
      throw new ProviderError(`${provider.label} did not answer in time. Try again.`, 504, "timeout");
    }
    throw new ProviderError(`${provider.label} could not be reached: ${e.message}`, 502, "upstream_error");
  } finally {
    clearTimeout(timer);
  }
}

async function describeFailure(res, provider) {
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body);
    detail = parsed.error?.message || parsed.message || detail;
  } catch { /* not JSON — the raw text is the best we have */ }

  if (res.status === 401 || res.status === 403) {
    return `${provider.label} rejected the API key. Check it in the Vercel project settings.`;
  }
  if (res.status === 404) {
    return `${provider.label} does not know the model "${provider.model}". Set LLM_MODEL to a model your account can use.`;
  }
  if (res.status === 429) {
    return `${provider.label}'s free limit is spent for now. It resets on their schedule — try again later.`;
  }
  return `${provider.label} returned an error: ${detail || res.statusText}`;
}

/** Yields the payload of each `data:` line of a server-sent-events response. */
async function* sse(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    /* Frames can split across chunks, so only complete lines are consumed. */
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}
