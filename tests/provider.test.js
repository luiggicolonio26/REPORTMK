import { describe, expect, it } from "vitest";
import { pickProvider, ProviderError } from "../api/_lib/provider.js";

describe("provider selection", () => {
  it("picks the only provider that has a key", () => {
    expect(pickProvider({ GROQ_API_KEY: "k" }).name).toBe("groq");
    expect(pickProvider({ MISTRAL_API_KEY: "k" }).name).toBe("mistral");
    expect(pickProvider({ ANTHROPIC_API_KEY: "k" }).name).toBe("anthropic");
  });

  it("uses each provider's own default model and endpoint", () => {
    const groq = pickProvider({ GROQ_API_KEY: "k" });
    expect(groq.model).toBe("openai/gpt-oss-120b");
    expect(groq.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(groq.kind).toBe("openai");
    expect(groq.webSearch).toBe(false);
    expect(pickProvider({ ANTHROPIC_API_KEY: "k" }).webSearch).toBe(true);
  });

  it("lets LLM_MODEL override the default", () => {
    expect(pickProvider({ GROQ_API_KEY: "k", LLM_MODEL: "qwen/qwen3.6-27b" }).model).toBe("qwen/qwen3.6-27b");
    expect(pickProvider({ GROQ_API_KEY: "k", LLM_MODEL: "qwen/qwen3.6-27b" }).pinned).toBe(true);
    expect(pickProvider({ GROQ_API_KEY: "k" }).pinned).toBe(false);
    // an empty value is not an override
    expect(pickProvider({ GROQ_API_KEY: "k", LLM_MODEL: "  " }).model).toBe("openai/gpt-oss-120b");
  });

  it("refuses to guess when two providers are configured", () => {
    // A half-finished migration must fail loudly, not quietly bill the old one.
    expect(() => pickProvider({ GROQ_API_KEY: "k", ANTHROPIC_API_KEY: "k2" })).toThrow(/LLM_PROVIDER/);
    const chosen = pickProvider({ GROQ_API_KEY: "k", ANTHROPIC_API_KEY: "k2", LLM_PROVIDER: "groq" });
    expect(chosen.name).toBe("groq");
  });

  it("says what is missing rather than failing obscurely", () => {
    expect(() => pickProvider({})).toThrow(/No model provider is configured/);
    expect(() => pickProvider({ LLM_PROVIDER: "groq" })).toThrow(/GROQ_API_KEY is not set/);
    expect(() => pickProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "k" })).toThrow(/not one of/);
  });

  it("reports a status and code the routes can pass through", () => {
    try {
      pickProvider({});
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect(e.status).toBe(503);
      expect(e.code).toBe("no_api_key");
    }
  });

  it("is case-insensitive about LLM_PROVIDER", () => {
    expect(pickProvider({ LLM_PROVIDER: "GROQ", GROQ_API_KEY: "k" }).name).toBe("groq");
  });
});

describe("model discovery", () => {
  it("prefers the strongest chat model the account can see", async () => {
    const { chooseModel } = await import("../api/_lib/provider.js");
    // What a Groq account actually returns today, after the June 2026 retirements.
    const groq = [
      "whisper-large-v3", "llama-guard-4-12b", "openai/gpt-oss-20b",
      "openai/gpt-oss-120b", "qwen/qwen3.6-27b", "playai-tts",
    ];
    expect(chooseModel(groq, "groq", "fallback")).toBe("openai/gpt-oss-120b");
    expect(chooseModel(["qwen/qwen3.6-27b", "openai/gpt-oss-20b"], "groq", "fb")).toBe("qwen/qwen3.6-27b");
    expect(chooseModel(["mistral-small-latest", "mistral-large-latest"], "mistral", "fb")).toBe("mistral-small-latest");
  });

  it("falls back to the default when the account lists nothing", async () => {
    const { chooseModel } = await import("../api/_lib/provider.js");
    expect(chooseModel([], "groq", "openai/gpt-oss-120b")).toBe("openai/gpt-oss-120b");
  });

  it("takes whatever is there when no preference matches", async () => {
    const { chooseModel } = await import("../api/_lib/provider.js");
    expect(chooseModel(["some-new-model-2027"], "groq", "fb")).toBe("some-new-model-2027");
  });

  it("does not pick a model that cannot write a report", async () => {
    const { listModels } = await import("../api/_lib/provider.js");
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: [
          { id: "whisper-large-v3" }, { id: "llama-guard-4-12b" }, { id: "playai-tts" },
          { id: "voxtral-mini-latest" }, { id: "mistral-embed" },
          { id: "openai/gpt-oss-120b" },
          { id: "codestral-latest", capabilities: { completion_chat: false } },
        ],
      }),
    });
    const ids = await listModels({ baseUrl: "http://x/v1", apiKey: "k" });
    expect(ids).toEqual(["openai/gpt-oss-120b"]);
  });

  it("survives an unreachable models endpoint", async () => {
    const { listModels } = await import("../api/_lib/provider.js");
    globalThis.fetch = async () => { throw new Error("network down"); };
    expect(await listModels({ baseUrl: "http://x/v1", apiKey: "k" })).toEqual([]);
  });
});
