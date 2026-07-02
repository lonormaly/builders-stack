import type { MetadataRoute } from "next";
import { getAllPosts } from "../lib/posts";
import { SITE_URL } from "./seo";

// Emitted at /sitemap.xml. The index plus one entry per post — generated from the
// content directory, so a new .mdx file shows up automatically. `lastModified` uses
// each post's updatedAt (the freshness signal), the index uses the newest post.
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const newest = posts[0]?.updatedAt ?? new Date().toISOString();

  return [
    {
      url: new URL("/", SITE_URL).toString(),
      lastModified: new Date(newest),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...posts.map((post) => ({
      url: new URL(`/${post.slug}`, SITE_URL).toString(),
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
