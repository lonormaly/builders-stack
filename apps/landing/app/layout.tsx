import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@stack/analytics";
import { SITE_URL } from "./seo";

const NAME = "Builder's Stack";
const DESCRIPTION =
  "An AI-native monorepo starter: apps · services · libs. Clone it, run one command, and you have a live app, a shared design system, and a repo that stays fast as it grows.";

// metadataBase makes every relative OG/canonical URL absolute. Env-driven origin.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${NAME} — an AI-native monorepo starter`,
    template: `%s — ${NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "monorepo starter",
    "Next.js monorepo",
    "AI-native",
    "Nx",
    "Bun",
    "Better Auth",
    "Drizzle ORM",
    "shadcn/ui",
    "TypeScript boilerplate",
    "full-stack template",
  ],
  applicationName: NAME,
  authors: [{ name: NAME }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: NAME,
    title: `${NAME} — an AI-native monorepo starter`,
    description: DESCRIPTION,
    // og:image comes from app/opengraph-image.tsx automatically.
  },
  twitter: {
    card: "summary_large_image",
    title: `${NAME} — an AI-native monorepo starter`,
    description: DESCRIPTION,
  },
};

// Structured data (schema.org) so search + AI engines can cite the product precisely.
// SoftwareApplication + WebSite + Organization as one @graph.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: NAME,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      description: DESCRIPTION,
      url: SITE_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
    },
    {
      "@type": "WebSite",
      name: NAME,
      url: SITE_URL,
    },
    {
      "@type": "Organization",
      name: NAME,
      url: SITE_URL,
    },
  ],
};

// PUBLIC surface — no auth, never redirects on session. Same shared <Analytics/>
// provider as apps/web, so a visitor here and the same person signed into the app
// resolve to ONE PostHog person (cross-subdomain identity) — the full funnel.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Analytics>{children}</Analytics>
      </body>
    </html>
  );
}
