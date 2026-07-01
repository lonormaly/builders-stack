import type { MetadataRoute } from "next";
import { SITE_URL } from "./seo";

// /sitemap.xml. Only the public landing route of the app — auth/health are internal.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", SITE_URL).toString(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
