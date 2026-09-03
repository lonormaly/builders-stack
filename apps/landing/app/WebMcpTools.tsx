"use client";

import { useRegisterTools } from "@stack/webmcp";
import { LANDING_TOOLS } from "./webmcp-tools";

// Registers this site's WebMCP tools (defined in ./webmcp-tools.ts, shared with the
// static /.well-known/webmcp-tools.json manifest). No-ops on every browser without
// WebMCP support. See docs/stack/webmcp.md.
export function WebMcpTools() {
  useRegisterTools(LANDING_TOOLS);
  return null;
}
