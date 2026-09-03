import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineTool, registerTool, registerTools } from "./register";
import { hasWebMcpSupport } from "./types";
import type { ModelContextToolInit } from "./types";

// bun test has no DOM by default (no jsdom/happy-dom dependency here — this lib stays
// light). A plain object standing in for `document.modelContext` is enough: these
// tests only ever touch that one property, never a real DOM.
function stubModelContext() {
  const registered: ModelContextToolInit[] = [];
  const modelContext = {
    registerTool: async (tool: ModelContextToolInit) => {
      registered.push(tool);
      return undefined;
    },
  };
  (globalThis as { document?: unknown }).document = { modelContext };
  return registered;
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

describe("defineTool", () => {
  test("rejects a name outside the spec's pattern", () => {
    expect(() =>
      defineTool({
        name: "bad name with spaces",
        description: "d",
        inputSchema: z.object({}),
        execute: () => ({ content: [] }),
      }),
    ).toThrow(/1-128 chars/);
  });

  test("accepts a spec-valid name", () => {
    const tool = defineTool({
      name: "search-docs",
      description: "d",
      inputSchema: z.object({ query: z.string() }),
      execute: () => ({ content: [] }),
    });
    expect(tool.name).toBe("search-docs");
  });
});

describe("registerTool — no browser support", () => {
  test("RED-guard: no document.modelContext → returns false, never throws", async () => {
    expect(hasWebMcpSupport()).toBe(false);
    const tool = defineTool({
      name: "noop-tool",
      description: "d",
      inputSchema: z.object({}),
      execute: () => ({ content: [] }),
    });
    await expect(registerTool(tool)).resolves.toBe(false);
  });
});

describe("registerTool — with document.modelContext present", () => {
  test("converts the zod schema to JSON Schema and forwards name/description", async () => {
    const registered = stubModelContext();
    const tool = defineTool({
      name: "search-docs",
      title: "Search docs",
      description: "Search the documentation site",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: (input) => ({ content: [{ type: "text", text: `found: ${input.query}` }] }),
    });

    const ok = await registerTool(tool);
    expect(ok).toBe(true);
    expect(registered).toHaveLength(1);
    const sent = registered[0]!;
    expect(sent.name).toBe("search-docs");
    expect(sent.title).toBe("Search docs");
    expect(sent.description).toBe("Search the documentation site");
    expect(sent.inputSchema).toMatchObject({ type: "object" });
  });

  test("validates input against the zod schema before calling execute", async () => {
    const registered = stubModelContext();
    let executed: unknown;
    const tool = defineTool({
      name: "add-item",
      description: "d",
      inputSchema: z.object({ text: z.string().min(1) }),
      execute: (input) => {
        executed = input;
        return { content: [{ type: "text", text: "ok" }] };
      },
    });
    await registerTool(tool);

    // Simulate what the browser does: call the wrapped execute with raw agent input.
    const sentTool = registered[0]!;
    const signal = new AbortController().signal;

    await sentTool.execute({ text: "hello" }, { signal });
    expect(executed).toEqual({ text: "hello" });

    await expect(sentTool.execute({}, { signal })).rejects.toThrow();
  });
});

describe("registerTools", () => {
  test("registers every tool and no-ops as a group without support", async () => {
    expect(await registerTools([])).toBe(false);

    const registered = stubModelContext();
    const tools = [
      defineTool({
        name: "a",
        description: "d",
        inputSchema: z.object({}),
        execute: () => ({ content: [] }),
      }),
      defineTool({
        name: "b",
        description: "d",
        inputSchema: z.object({}),
        execute: () => ({ content: [] }),
      }),
    ];
    expect(await registerTools(tools)).toBe(true);
    expect(new Set(registered.map((t) => t.name))).toEqual(new Set(["a", "b"]));
  });
});
