import { z } from "zod";
import type { ToolDefinition } from "./register";

/** The static, JSON-serializable shape of a tool — what `/.well-known/webmcp-tools.json` serves. */
export interface ToolManifestEntry {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
}

/**
 * Converts tool definitions to a static manifest — the same zod schemas `registerTool()`
 * converts at runtime, serialized once so a `.well-known/webmcp-tools.json` route can
 * serve them without a browser. One source of truth: an app's tool defs feed BOTH the
 * live `document.modelContext.registerTool()` call and this manifest, so they can't drift.
 *
 * Why a manifest at all, when WebMCP itself has no such file: the imperative API only
 * exists inside a running browser with WebMCP support (an origin trial today — see
 * docs/stack/webmcp.md) — nothing server-side can observe it. A static, fetchable
 * manifest is what lets `check:agent-readability`'s WebMCP section (and any agent that
 * doesn't have live WebMCP support yet) verify what tools a page WOULD register,
 * without needing a browser to run the actual API.
 */
export function toolManifest(defs: ToolDefinition<z.ZodObject>[]): ToolManifestEntry[] {
  return defs.map((def) => ({
    name: def.name,
    ...(def.title ? { title: def.title } : {}),
    description: def.description,
    inputSchema: z.toJSONSchema(def.inputSchema),
    ...(def.annotations ? { annotations: def.annotations } : {}),
  }));
}
