// Ambient types for the WebMCP browser API — not yet in TypeScript's DOM lib (the spec
// is a W3C Web Machine Learning Community Group Draft Report, no browser ships it by
// default). Hand-typed from the spec's WebIDL, current as of 2 September 2026:
// https://webmachinelearning.github.io/webmcp/
//
// The access point is `document.modelContext` — NOT `navigator.modelContext`. See
// docs/stack/webmcp.md for why that matters if you've seen an older write-up.

export interface ModelContextToolAnnotations {
  /** The tool only reads state; calling it has no side effects. Default false. */
  readOnlyHint?: boolean;
  /** The tool's result may contain content from an untrusted source. Default false. */
  untrustedContentHint?: boolean;
}

/** What a tool's `execute` resolves to — MCP's content-block result shape. */
export interface ModelContextToolResult {
  content: { type: "text"; text: string }[];
}

export interface ModelContextToolExecuteOptions {
  signal: AbortSignal;
}

export type ModelContextToolExecute = (
  input: Record<string, unknown>,
  options: ModelContextToolExecuteOptions,
) => Promise<ModelContextToolResult> | ModelContextToolResult;

/** The spec's `ModelContextTool` dictionary — what `registerTool()` takes. */
export interface ModelContextToolInit {
  name: string;
  title?: string;
  description: string;
  /** JSON Schema. Optional per spec, but @stack/webmcp always supplies one (from zod). */
  inputSchema?: object;
  execute: ModelContextToolExecute;
  annotations?: ModelContextToolAnnotations;
}

export interface ModelContextRegisterToolOptions {
  /** Origins allowed to see/call this tool. Omit for same-origin default. */
  exposedTo?: string[];
  /** Aborting this unregisters the tool — the spec has no separate unregister call. */
  signal?: AbortSignal;
}

export interface RegisteredTool {
  name: string;
}

export interface ModelContextAPI extends EventTarget {
  registerTool(
    tool: ModelContextToolInit,
    options?: ModelContextRegisterToolOptions,
  ): Promise<undefined>;
  getTools(): Promise<RegisteredTool[]>;
  executeTool(tool: RegisteredTool, inputObject?: Record<string, unknown>): Promise<string>;
}

/** `document` narrowed to carry `modelContext` — only true on a supporting browser. */
export interface DocumentWithModelContext extends Document {
  modelContext: ModelContextAPI;
}

export function hasWebMcpSupport(): boolean {
  return typeof document !== "undefined" && "modelContext" in document;
}
