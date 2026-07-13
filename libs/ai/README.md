# @stack/ai

Provider-agnostic model client over the [Vercel AI SDK](https://ai-sdk.dev).
One typed `generate()` / `stream()` surface; swap providers with a string.

## Setup

Set one env var — the key for whichever provider you default to:

```bash
export AI_API_KEY="sk-..."
```

## Generate

```ts
import { generate } from "@stack/ai";

const { text, usage } = await generate({ prompt: "Write a haiku about lazy code." });
```

## Stream

```ts
import { stream } from "@stack/ai";

const result = stream({ prompt: "Count to five, slowly." });
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
// result also exposes toTextStreamResponse(), usage, finishReason, ...
```

## Swap providers

Provider + model are just strings. Default is `openai` / `gpt-5.5`. See [`docs/stack/ai.md`](../../docs/stack/ai.md) — `AI_API_KEY` must match the default provider, and there's no free tier.

```ts
await generate({
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  system: "You are terse.",
  messages: [{ role: "user", content: "Hello" }],
  temperature: 0.2,
  maxTokens: 256,
  apiKey: process.env.ANTHROPIC_KEY, // optional per-call override of AI_API_KEY
});
```

Add a provider by adding one line to the `factories` map in `src/providers.ts`.
`getModel(provider, modelId, apiKey?)` is exported if you want the raw SDK model.

## Options

`generate` / `stream` share `GenerateOptions`: `prompt` **or** `messages`,
plus optional `provider`, `model`, `system`, `temperature`, `maxTokens`, `apiKey`.

## Dev

```bash
bun run typecheck   # tsc --noEmit
bun run check       # runs the no-network self-check in src/providers.ts
```
