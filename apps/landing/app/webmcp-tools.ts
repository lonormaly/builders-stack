import { z } from "zod";
import { defineTool } from "@stack/webmcp";
import { FEATURES } from "./features";

// The tool definition itself, separate from WebMcpTools.tsx (a "use client" component):
// this same definition feeds BOTH the live `registerTool()` call (client-side) and the
// static `/.well-known/webmcp-tools.json` manifest (server-side, no "use client" needed)
// — one source of truth, see docs/stack/webmcp.md.
export const DESCRIBE_PRODUCT = defineTool({
  name: "describe_product",
  title: "Describe Builder's Stack",
  description: "Get a short summary of Builder's Stack and its main features.",
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true },
  execute: () => {
    const text = [
      "Builder's Stack — an AI-native monorepo starter: apps · services · libs.",
      ...FEATURES.map((f) => `- ${f.title}: ${f.body}`),
    ].join("\n");
    return { content: [{ type: "text", text }] };
  },
});

export const LANDING_TOOLS = [DESCRIBE_PRODUCT];
