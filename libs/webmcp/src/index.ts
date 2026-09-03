// @stack/webmcp — declare an app's agent-callable tools once (typed, zod-validated)
// and register them with the browser's WebMCP API (`document.modelContext`). A no-op
// on every browser that doesn't support it yet (which is most of them — see
// docs/stack/webmcp.md for exactly which do, and since when).
//
// `defineTool()` + `registerTool()`/`registerTools()` for the imperative API;
// `useRegisterTools()` for a client component; `declarativeToolForm()`/
// `declarativeToolParam()` for the experimental HTML-attribute fallback.

export { defineTool, registerTool, registerTools } from "./register";
export type { ToolDefinition } from "./register";

export { useRegisterTools } from "./use-register-tools";

export { declarativeToolForm, declarativeToolParam } from "./declarative";
export type { DeclarativeToolFormProps, DeclarativeToolParamProps } from "./declarative";

export { toolManifest } from "./manifest";
export type { ToolManifestEntry } from "./manifest";

export { hasWebMcpSupport } from "./types";
export type {
  ModelContextAPI,
  ModelContextToolAnnotations,
  ModelContextToolExecute,
  ModelContextToolInit,
  ModelContextToolResult,
  ModelContextRegisterToolOptions,
  RegisteredTool,
} from "./types";
