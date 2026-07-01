import type { MetadataRoute } from "next";
import { SITE_URL } from "./seo";

// Emitted at /sitemap.xml. One entry per public route — this is a single-page
// marketing site, so add routes to this array as you add pages.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/"];
  return routes.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
