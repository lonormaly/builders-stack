import { llmsFullTxt } from "../llms";

// Serves /llms-full.txt — the curated shortlist plus full prose, in one document.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsFullTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
