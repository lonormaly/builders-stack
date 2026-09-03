import { NextResponse } from "next/server";
import { toolManifest } from "@stack/webmcp";
import { WEB_GLOSSARY_TOOLS } from "../../glossary/webmcp-tools";

// /.well-known/webmcp-tools.json — a static, fetchable listing of every WebMCP tool
// this app registers, generated from the SAME tool definitions the live
// document.modelContext.registerTool() call uses (see ../../glossary/webmcp-tools.ts).
// Not part of the WebMCP spec (which has no such manifest — the imperative API only
// exists inside a running, supporting browser) — this is what lets
// check:agent-readability's WebMCP section (and any agent without live WebMCP
// support yet) verify what tools a page WOULD register. See docs/stack/webmcp.md.
export function GET(): Response {
  return NextResponse.json(toolManifest(WEB_GLOSSARY_TOOLS));
}
