import type { MetadataRoute } from "next";
import { SITE_URL } from "./seo";

// /sitemap.xml. The public routes of the app — auth/health are internal.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", SITE_URL).toString(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/glossary", SITE_URL).toString(),
      lastModified: new Date("2026-09-01"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
