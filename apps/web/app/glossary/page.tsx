import { breadcrumbJsonLd, JsonLd, pageMetadata, webPageJsonLd } from "@stack/seo";
import { GLOSSARY_TERMS } from "../glossary-terms";
import { SITE_URL } from "../seo";
import { WebMcpTools } from "./WebMcpTools";

const DESCRIPTION =
  "Terms used across Builder's Stack — apps/services/libs, Nx, module boundaries, portless, worktrees, env-gated batteries, agent readability, and WebMCP — defined in one place.";
const LAST_UPDATED = "2026-09-01";

// This page's canonical metadata — one door (@stack/seo). markdownMirror: true wires
// the <link rel="alternate" type="text/markdown"> the agent-readability spec checks
// for; the mirror itself is served by app/api/md/[...path]/route.ts.
export const metadata = pageMetadata({
  title: "Glossary",
  description: DESCRIPTION,
  path: "/glossary",
  markdownMirror: true,
});

export default function GlossaryPage() {
  const url = `${SITE_URL}/glossary`;
  const structuredData = [
    webPageJsonLd({ name: "Glossary", url, description: DESCRIPTION, dateModified: LAST_UPDATED }),
    breadcrumbJsonLd([
      { name: "Design system", url: `${SITE_URL}/` },
      { name: "Glossary", url },
    ]),
  ];

  return (
    <div className="flex flex-col gap-8">
      <JsonLd data={structuredData} />
      <WebMcpTools />

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Glossary</h1>
        <p className="max-w-2xl text-muted-foreground">{DESCRIPTION}</p>
      </div>

      <div className="flex flex-col gap-8">
        {GLOSSARY_TERMS.map((t) => (
          <section key={t.term} className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{t.term}</h2>
            <p className="max-w-2xl leading-7 text-foreground/90">{t.definition}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
