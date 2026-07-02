import type { Metadata } from "next";
import "./globals.css";
import { Analytics, ConsentBanner } from "@stack/analytics";
import { JsonLd, organizationJsonLd, pageMetadata, websiteJsonLd } from "@stack/seo";
import { SITE_URL } from "./seo";

const NAME = "Builder's Stack";
const DESCRIPTION =
  "An AI-native monorepo starter: apps · services · libs. Clone it, run one command, and you have a live app, a shared design system, and a repo that stays fast as it grows.";

// One door for metadata — pageMetadata() fills metadataBase, canonical, OG, twitter, and
// the `%s — Builder's Stack` title template from @stack/config. No hand-rolled OG here.
export const metadata: Metadata = pageMetadata({
  description: DESCRIPTION,
  tagline: "an AI-native monorepo starter",
});

// Sitewide structured data (schema.org) for rich results — Organization + WebSite, built
// by @stack/seo. Per Google's AI guide this is for rich results, not an AI ranking lever.
const structuredData = [
  organizationJsonLd({ name: NAME, url: SITE_URL }),
  websiteJsonLd({ name: NAME, url: SITE_URL, description: DESCRIPTION }),
];

// PUBLIC surface — no auth, never redirects on session. Same shared <Analytics/>
// provider as apps/web, so a visitor here and the same person signed into the app
// resolve to ONE PostHog person (cross-subdomain identity) — the full funnel.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <JsonLd data={structuredData} />
        <Analytics>{children}</Analytics>
        {/* GDPR: analytics stay dormant until the visitor accepts here. */}
        <ConsentBanner policyHref="/privacy" />
      </body>
    </html>
  );
}
