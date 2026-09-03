import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineTool } from "./register";
import { toolManifest } from "./manifest";

describe("toolManifest", () => {
  test("serializes name/title/description/inputSchema/annotations, JSON Schema for the schema", () => {
    const tool = defineTool({
      name: "search_docs",
      title: "Search docs",
      description: "Search the documentation",
      inputSchema: z.object({ query: z.string().min(1) }),
      annotations: { readOnlyHint: true },
      execute: () => ({ content: [] }),
    });

    const manifest = toolManifest([tool]);
    expect(manifest).toHaveLength(1);
    expect(manifest[0]).toMatchObject({
      name: "search_docs",
      title: "Search docs",
      description: "Search the documentation",
      annotations: { readOnlyHint: true },
    });
    expect(manifest[0]!.inputSchema).toMatchObject({
      type: "object",
      properties: { query: expect.objectContaining({ type: "string" }) },
    });
  });

  test("omits title/annotations when not set, rather than emitting undefined", () => {
    const tool = defineTool({
      name: "noop",
      description: "d",
      inputSchema: z.object({}),
      execute: () => ({ content: [] }),
    });
    const [entry] = toolManifest([tool]);
    expect(entry).not.toHaveProperty("title");
    expect(entry).not.toHaveProperty("annotations");
    expect(JSON.stringify(entry)).not.toContain("undefined");
  });

  test("empty list → empty manifest", () => {
    expect(toolManifest([])).toEqual([]);
  });
});
