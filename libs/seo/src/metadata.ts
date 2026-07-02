import type { Metadata } from "next";
import { siteConfig } from "@stack/config";

// pageMetadata() — the one door for a page's Next.js Metadata. Callers pass what's
// unique to the page (title/description/path/image); this fills the drift-prone rest
// (metadataBase, canonical, openGraph, twitter, title template) from @stack/config so
// no page hand-rolls OG/canonical. Aligned with Google's AI optimization guide: correct
// crawlable metadata on a server-rendered page — not "written for AI".

export interface PageMetadataInput {
  /** Page title. Omit on a root layout to get the site default + `%s — Site` template. */
  title?: string;
  description?: string;
  /** Canonical path, e.g. "/pricing". Defaults to "/". */
  path?: string;
  /** OG/twitter image URL or path. Omit to fall back to the app's opengraph-image.tsx. */
  image?: string;
  /** Only used when `title` is omitted — the site's default-title suffix ("Site — tagline"). */
  tagline?: string;
  /** Keep the page out of the index (login/health/internal pages). */
  noIndex?: boolean;
}

export function pageMetadata(input: PageMetadataInput = {}): Metadata {
  const { name, url } = siteConfig();
  const path = input.path ?? "/";
  const ogUrl = new URL(path, url).toString();

  const defaultTitle = input.tagline ? `${name} — ${input.tagline}` : name;
  // A page with its own title → plain string (composed by the layout's %s template).
  // No title → set the site default + template, which is what a root layout wants.
  const title: Metadata["title"] = input.title
    ? input.title
    : { default: defaultTitle, template: `%s — ${name}` };
  const socialTitle = input.title ?? defaultTitle;
  const images = input.image ? [{ url: input.image }] : undefined;

  return {
    metadataBase: new URL(url),
    title,
    description: input.description,
    applicationName: name,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: ogUrl,
      siteName: name,
      title: socialTitle,
      description: input.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
      ...(images ? { images } : {}),
    },
    ...(input.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
