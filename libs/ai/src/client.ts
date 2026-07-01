import { generateText, streamText } from "ai";
import type { ModelMessage } from "ai";
import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  getModel,
  resolveApiKey,
  type Provider,
} from "./providers";

/** Shared options for {@link generate} and {@link stream}. Pass `prompt` OR `messages`. */
export interface GenerateOptions {
  /** Single-turn prompt. Mutually exclusive with `messages`. */
  prompt?: string;
  /** Multi-turn conversation. Mutually exclusive with `prompt`. */
  messages?: ModelMessage[];
  /** Which provider to use. Defaults to {@link DEFAULT_PROVIDER}. */
  provider?: Provider;
  /** Model id string, e.g. "gpt-5.5". Defaults per-provider (see DEFAULT_MODELS). */
  model?: string;
  /** System instructions. */
  system?: string;
  temperature?: number;
  /** Max output tokens (SDK v7 name: maxOutputTokens). */
  maxTokens?: number;
  /** Override the key for this call; else reads AI_API_KEY from env. */
  apiKey?: string;
}

export interface GenerateResult {
  text: string;
  usage: Awaited<ReturnType<typeof generateText>>["usage"];
}

/** Map our options onto the SDK call shape; validate the prompt/messages xor. */
function buildCallOptions(opts: GenerateOptions) {
  if (opts.prompt === undefined && opts.messages === undefined) {
    throw new Error("@stack/ai: provide `prompt` or `messages`.");
  }
  const provider = opts.provider ?? DEFAULT_PROVIDER;
  const modelId = opts.model ?? DEFAULT_MODELS[provider];
  const settings = {
    model: getModel(provider, modelId, resolveApiKey(opts.apiKey)),
    instructions: opts.system,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxTokens,
  };
  // Keep prompt/messages as distinct union members so the SDK's Prompt type is satisfied.
  return opts.messages !== undefined
    ? { ...settings, messages: opts.messages }
    : { ...settings, prompt: opts.prompt ?? "" };
}

/** One-shot generation. Returns the trimmed `{ text, usage }`. */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { text, usage } = await generateText(buildCallOptions(opts));
  return { text, usage };
}

/**
 * Streaming generation. Returns the full SDK stream result so callers keep the
 * whole surface — `result.textStream`, `result.toTextStreamResponse()`, etc.
 * Not async: `streamText` returns synchronously and streams lazily.
 */
export function stream(opts: GenerateOptions) {
  return streamText(buildCallOptions(opts));
}
