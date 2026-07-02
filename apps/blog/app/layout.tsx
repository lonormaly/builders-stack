import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@stack/analytics";
import { JsonLd, organizationJsonLd, pageMetadata, websiteJsonLd } from "@stack/seo";
import { BLOG_DESCRIPTION, BLOG_NAME, SITE_URL } from "./seo";

// One door for metadata — pageMetadata() fills metadataBase, canonical, OG, twitter and
// the `%s — Builder's Stack Blog` title template from @stack/config. No hand-rolled OG.
export const metadata: Metadata = pageMetadata({
  description: BLOG_DESCRIPTION,
  tagline: "field notes from an AI-native monorepo",
});

// Sitewide structured data — Organization + WebSite (schema.org) for rich results.
// Per Google's AI guide this is for rich results, not an AI ranking lever.
const structuredData = [
  organizationJsonLd({ name: "Builder's Stack", url: SITE_URL }),
  websiteJsonLd({ name: BLOG_NAME, url: SITE_URL, description: BLOG_DESCRIPTION }),
];

// PUBLIC surface — no auth, never redirects on session. Same shared <Analytics/>
// provider as the app so a reader here and the same person in the app resolve to ONE
// PostHog person (cross-subdomain identity).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <JsonLd data={structuredData} />
        <Analytics>{children}</Analytics>
      </body>
    </html>
  );
}
