import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { markdownRewriteTarget } from "@stack/seo";

// Agent-readability content negotiation (see docs/stack/agent-readability.md): a
// request for an explicit `.md` URL, or one that sends `Accept: text/markdown`, gets
// rewritten to this app's markdown mirror instead of the HTML page. The routing
// decision is a pure function in @stack/seo (unit-tested there); this is just the
// Next.js glue. (`proxy` is Next 16's name for the old middleware.ts convention —
// apps/web and apps/landing already carry one of these for CSP; this app doesn't have
// a CSP proxy yet, so this file is markdown-negotiation only.)
export function proxy(request: NextRequest) {
  const target = markdownRewriteTarget(request.nextUrl.pathname, request.headers.get("accept"));
  if (!target) return NextResponse.next();
  return NextResponse.rewrite(new URL(target, request.url));
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
