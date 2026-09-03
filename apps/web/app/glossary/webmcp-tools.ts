import { z } from "zod";
import { defineTool } from "@stack/webmcp";
import { GLOSSARY_TERMS } from "../glossary-terms";

// The tool definition itself, separate from WebMcpTools.tsx (a "use client" component):
// this same definition feeds BOTH the live `registerTool()` call (client-side) and the
// static `/.well-known/webmcp-tools.json` manifest (server-side, no "use client" needed)
// — one source of truth, see docs/stack/webmcp.md.
export const SEARCH_GLOSSARY = defineTool({
  name: "search_glossary",
  title: "Search glossary",
  description:
    'Look up a term used across Builder\'s Stack (e.g. "worktree", "module boundaries", "portless") and get its definition.',
  inputSchema: z.object({
    query: z.string().min(1).describe("A term, or part of one, to search for."),
  }),
  annotations: { readOnlyHint: true },
  execute: ({ query }) => {
    const needle = query.toLowerCase();
    const matches = GLOSSARY_TERMS.filter(
      (t) => t.term.toLowerCase().includes(needle) || t.definition.toLowerCase().includes(needle),
    );
    const text =
      matches.length > 0
        ? matches.map((t) => `${t.term}: ${t.definition}`).join("\n\n")
        : `No glossary term matches "${query}".`;
    return { content: [{ type: "text", text }] };
  },
});

export const WEB_GLOSSARY_TOOLS = [SEARCH_GLOSSARY];
