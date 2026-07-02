import type { JsonLdData } from "./json-ld";

// Renders one or more schema.org nodes as <script type="application/ld+json">.
// A plain server component (no "use client") — it emits inert JSON into the SSR HTML,
// so the markup is present for crawlers on first byte (per the Google guide: content
// must be server-rendered and crawlable). Feed it the builders from ./json-ld.
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  // Escape `<` so a value containing "</script>" (or "<!--") can't break out of the tag —
  // the standard JSON-LD XSS guard. < is still valid JSON, so the structured data
  // parses unchanged.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  // dangerouslySetInnerHTML is the only way to emit a raw JSON-LD script body; the
  // input is escaped JSON.stringify output (see above), never user HTML.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
