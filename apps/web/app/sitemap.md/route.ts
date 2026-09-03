import { sitemapMd, textFileResponse } from "@stack/seo";
import { SITE_URL } from "../seo";

// /sitemap.md — the markdown sitemap the agent-readability spec asks for alongside
// sitemap.xml: headings + links reflecting site structure, for an agent that reads
// markdown instead of parsing XML.
export function GET(): Response {
  const body = sitemapMd("Builder's Stack — Web", [
    {
      heading: "Pages",
      links: [
        { title: "Design system", url: new URL("/", SITE_URL).toString() },
        { title: "Glossary", url: new URL("/glossary", SITE_URL).toString() },
      ],
    },
    {
      heading: "Machine-readable",
      links: [
        { title: "AGENTS.md", url: new URL("/AGENTS.md", SITE_URL).toString() },
        { title: "llms.txt", url: new URL("/llms.txt", SITE_URL).toString() },
        { title: "llms-full.txt", url: new URL("/llms-full.txt", SITE_URL).toString() },
      ],
    },
  ]);
  return textFileResponse(body);
}
