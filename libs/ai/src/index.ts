// Public door for @stack/ai. Import only from here.
export { generate, stream } from "./client";
export type { GenerateOptions, GenerateResult } from "./client";
export { getModel, resolveApiKey, DEFAULT_PROVIDER, DEFAULT_MODELS } from "./providers";
export type { Provider } from "./providers";

// Re-export the SDK's model type for callers who build models directly.
export type { LanguageModel, ModelMessage } from "ai";

// Namespace convenience: `import { ai } from "@stack/ai"` → ai.generate(), ai.stream().
import { generate as _generate, stream as _stream } from "./client";
export const ai = { generate: _generate, stream: _stream };
