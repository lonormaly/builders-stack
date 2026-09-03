"use client";

import { useEffect } from "react";
import type { z } from "zod";
import { registerTools, type ToolDefinition } from "./register";

/**
 * Registers `tools` with `document.modelContext` on mount, and unregisters them (via
 * AbortController, per the spec) on unmount or when `tools` changes identity. A no-op
 * effect on a browser without WebMCP support — see hasWebMcpSupport() in ./types.
 *
 * Pass a stable array (useMemo, or module-scope tools) — a new array identity every
 * render would re-register on every render.
 */
export function useRegisterTools(tools: ToolDefinition<z.ZodObject>[]): void {
  useEffect(() => {
    if (tools.length === 0) return;
    const controller = new AbortController();
    void registerTools(tools, { signal: controller.signal });
    return () => controller.abort();
    // `tools` compared by reference is the documented contract (see the docstring
    // above): pass a stable array, don't inline a new one on every render.
  }, [tools]);
}
