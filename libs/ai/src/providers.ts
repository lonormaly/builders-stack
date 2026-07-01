import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/** Providers this client knows how to build. Add a provider = add one line to `factories`. */
export type Provider = "openai" | "anthropic";

export const DEFAULT_PROVIDER: Provider = "openai";

/** Sensible default model per provider. Override per-call with `opts.model`. */
export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5.5",
  anthropic: "claude-sonnet-4-5",
};

// ponytail: a map, not a factory-of-factories. Each entry maps an API key to a
// provider whose call signature is `(modelId) => LanguageModel`. Extend the map
// to add a provider — no interfaces, no registration ceremony.
const factories: Record<Provider, (apiKey?: string) => (modelId: string) => LanguageModel> = {
  openai: (apiKey) => createOpenAI({ apiKey }),
  anthropic: (apiKey) => createAnthropic({ apiKey }),
};

/**
 * Build a language model for the given provider + model id.
 *
 * The key is optional here on purpose: constructing a model hits no network, so
 * a missing key is fine until you actually call `generate`/`stream` (which is
 * where {@link resolveApiKey} enforces it). Passing an unknown provider throws.
 */
export function getModel(provider: Provider, modelId: string, apiKey?: string): LanguageModel {
  const make = factories[provider];
  if (!make) {
    throw new Error(
      `@stack/ai: unknown provider "${provider}". Expected one of: ${Object.keys(factories).join(", ")}`,
    );
  }
  return make(apiKey)(modelId);
}

/**
 * Resolve the API key for a call: explicit arg wins, else `AI_API_KEY` from env.
 * Throws a clear error at the call boundary if neither is present.
 */
export function resolveApiKey(explicit?: string): string {
  const key = explicit ?? process.env.AI_API_KEY;
  if (!key) {
    throw new Error(
      "@stack/ai: no API key. Set the AI_API_KEY env var or pass `apiKey` to the call.",
    );
  }
  return key;
}

// ── self-check (no network): `bun run src/providers.ts` ──────────────────────
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`self-check failed: ${msg}`);
}

if (import.meta.main) {
  assert(getModel("openai", "gpt-5.5"), "getModel(openai) returns a model");
  assert(getModel("anthropic", "claude-sonnet-4-5"), "getModel(anthropic) returns a model");

  let threw = false;
  try {
    getModel("bogus" as Provider, "x");
  } catch {
    threw = true;
  }
  assert(threw, "unknown provider throws");

  console.log("providers.ts self-check passed");
}
