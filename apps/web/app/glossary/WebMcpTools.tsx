"use client";

import { useRegisterTools } from "@stack/webmcp";
import { WEB_GLOSSARY_TOOLS } from "./webmcp-tools";

// Registers this page's WebMCP tools (defined in ./webmcp-tools.ts, shared with the
// static /.well-known/webmcp-tools.json manifest). No-ops on every browser without
// WebMCP support; renders nothing itself. See docs/stack/webmcp.md.
export function WebMcpTools() {
  useRegisterTools(WEB_GLOSSARY_TOOLS);
  return null;
}
