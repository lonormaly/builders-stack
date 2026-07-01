import { llmsTxt } from "../llms";

// Serves /llms.txt (llmstxt.org format) as text/plain. A route handler, not a static
// public/ file, so the URLs inside are built from SITE_URL (env) rather than hardcoded.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
