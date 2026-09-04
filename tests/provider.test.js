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
    expect(groq.model).toBe("llama-3.3-70b-versatile");
    expect(groq.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(groq.kind).toBe("openai");
    expect(groq.webSearch).toBe(false);
    expect(pickProvider({ ANTHROPIC_API_KEY: "k" }).webSearch).toBe(true);
  });

  it("lets LLM_MODEL override the default", () => {
    expect(pickProvider({ GROQ_API_KEY: "k", LLM_MODEL: "qwen3-32b" }).model).toBe("qwen3-32b");
    // an empty value is not an override
    expect(pickProvider({ GROQ_API_KEY: "k", LLM_MODEL: "  " }).model).toBe("llama-3.3-70b-versatile");
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
