import { z } from "zod";
import {
  hasWebMcpSupport,
  type DocumentWithModelContext,
  type ModelContextRegisterToolOptions,
  type ModelContextToolAnnotations,
  type ModelContextToolResult,
} from "./types";

// The one door for declaring + registering a WebMCP tool. `defineTool()` gives you
// input inference and a single call shape (mirrors how services/api's zod schemas are
// the contract both request validation and the typed client read from); `registerTool()`
// is the runtime half: converts your zod schema to the JSON Schema the spec's
// `inputSchema` wants, validates every call against it before your handler ever runs,
// and no-ops on a browser that doesn't have `document.modelContext` yet (every browser
// today, unless it's opted into the Chrome 149 / Edge 150 origin trial — see
// docs/stack/webmcp.md).

// Schema is constrained to z.ZodObject, not the more general z.ZodType: MCP's
// inputSchema is always a JSON Schema *object* (top-level "type": "object" with
// "properties") per the protocol, so a tool's arguments are always a named-field
// object — never a bare string/array/union at the top level. (This also sidesteps a
// real TypeScript+Zod4 generic-variance issue: a bare `z.ZodType` constraint fails to
// structurally accept a concrete ZodObject due to how v4 types its internals.)
export interface ToolDefinition<Schema extends z.ZodObject> {
  /** 1-128 chars, alphanumeric/underscore/hyphen/period only, per the spec. */
  name: string;
  /** Display name for a UI surfacing this tool. Omit to fall back to `name`. */
  title?: string;
  description: string;
  inputSchema: Schema;
  annotations?: ModelContextToolAnnotations;
  execute: (input: z.infer<Schema>) => Promise<ModelContextToolResult> | ModelContextToolResult;
}

const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

/**
 * Declares a tool: identity, a zod input schema, and the handler that runs when an
 * agent calls it. Doesn't touch the browser — pass the result to `registerTool()`
 * (or `registerTools()`) inside a client component's effect.
 */
export function defineTool<Schema extends z.ZodObject>(
  def: ToolDefinition<Schema>,
): ToolDefinition<Schema> {
  if (!NAME_PATTERN.test(def.name)) {
    throw new Error(
      `@stack/webmcp: tool name "${def.name}" must be 1-128 chars of letters, digits, "_", "-", or "." (WebMCP spec).`,
    );
  }
  return def;
}

/**
 * Registers one tool with `document.modelContext`. Returns `false` (a no-op, not a
 * throw) when the browser doesn't support WebMCP — always safe to call unconditionally
 * from a client component. Input is parsed with the tool's zod schema before `execute`
 * runs, so a malformed call from an agent never reaches your handler.
 */
export async function registerTool<Schema extends z.ZodObject>(
  def: ToolDefinition<Schema>,
  options?: ModelContextRegisterToolOptions,
): Promise<boolean> {
  if (!hasWebMcpSupport()) return false;

  const modelContext = (document as DocumentWithModelContext).modelContext;
  await modelContext.registerTool(
    {
      name: def.name,
      description: def.description,
      ...(def.title ? { title: def.title } : {}),
      inputSchema: z.toJSONSchema(def.inputSchema),
      ...(def.annotations ? { annotations: def.annotations } : {}),
      async execute(input) {
        const parsed = def.inputSchema.parse(input);
        return def.execute(parsed);
      },
    },
    options,
  );
  return true;
}

/**
 * Registers several tools at once, sharing one AbortSignal — abort it (e.g. on
 * unmount) to unregister all of them together, since the spec unregisters via the
 * signal passed to `registerTool()`, not a separate call.
 */
export async function registerTools(
  defs: ToolDefinition<z.ZodObject>[],
  options?: ModelContextRegisterToolOptions,
): Promise<boolean> {
  if (!hasWebMcpSupport()) return false;
  await Promise.all(defs.map((def) => registerTool(def, options)));
  return true;
}
