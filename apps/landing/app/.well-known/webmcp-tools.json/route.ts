import { NextResponse } from "next/server";
import { toolManifest } from "@stack/webmcp";
import { LANDING_TOOLS } from "../../webmcp-tools";

// /.well-known/webmcp-tools.json — a static, fetchable listing of every WebMCP tool
// this app registers, generated from the SAME tool definitions the live
// document.modelContext.registerTool() call uses (see ../../webmcp-tools.ts). Not part
// of the WebMCP spec itself — see docs/stack/webmcp.md.
export function GET(): Response {
  return NextResponse.json(toolManifest(LANDING_TOOLS));
}
