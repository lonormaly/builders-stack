# AI — `@stack/ai`

A provider-agnostic model client over the [Vercel AI SDK](https://sdk.vercel.ai). One typed `generate()` / `stream()` surface; swap providers with a string.

## The one thing to get right: `AI_API_KEY` must match the provider

`@stack/ai` ships with:

```ts
// libs/ai/src/providers.ts
export const DEFAULT_PROVIDER: Provider = "openai";
export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5.5",
  anthropic: "claude-sonnet-4-5",
};
```

Because the default provider is **openai**, the single `AI_API_KEY` env var must be an **OpenAI key** (`sk-…`) out of the box. Point it at the wrong provider and calls fail at the request boundary with an auth error.

## ⚠️ No free tier

Unlike every other integration in this stack, AI has **no env-gated free ride** — there's no key that "boots for free." The moment `@stack/ai` makes a call, you pay per token (OpenAI and Anthropic both bill from token 1). Keep costs down by choosing a cheaper model id (e.g. an OpenAI `-mini` / `-nano` class model) as your default. See [`costs.md`](./costs.md).

## Switching providers

Two ways, no code churn beyond the model client:

1. **Per call** — pass `provider` + `model`:

   ```ts
   import { ai } from "@stack/ai";
   await ai.generate({ provider: "anthropic", model: "claude-sonnet-4-5", prompt: "…" });
   ```

   Note: `AI_API_KEY` is resolved once for the whole client, so mixing providers per-call means passing an explicit `apiKey` for the non-default one.

2. **Change the default** — set `DEFAULT_PROVIDER = "anthropic"` in `libs/ai/src/providers.ts`, and make `AI_API_KEY` an Anthropic key (`sk-ant-…`).

**Add a provider** = add one line to the `factories` map in `providers.ts` (the SDK has `@ai-sdk/*` packages for OpenAI-compatible, Google, Groq, and more) and one entry to `DEFAULT_MODELS`. No interfaces, no registration ceremony.

## Model ids drift

Provider model ids change often. `gpt-5.5` and `claude-sonnet-4-5` are the current defaults (July 2026) — before shipping, confirm the exact id against the provider's models page (or ask your agent to check via the context7 MCP). Override per call with `opts.model` any time.

## Self-check

`bun --filter @stack/ai check` runs `providers.ts`'s no-network self-check (builds a model per provider, asserts an unknown provider throws).

Sources: [OpenAI models](https://developers.openai.com/api/docs/models) · [Anthropic models](https://docs.anthropic.com/en/docs/about-claude/models) · [Vercel AI SDK](https://sdk.vercel.ai/docs)
