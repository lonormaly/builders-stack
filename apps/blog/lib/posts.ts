import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

// The content layer: read MDX files, parse typed frontmatter, expose a sorted list +
// single-post lookup. Runs only at build time (SSG) — no runtime file reads in the
// browser. Files starting with `_` (e.g. content/_template.mdx) are ignored.

const CONTENT_DIR = join(process.cwd(), "content");

/** Frontmatter contract — every post MUST declare these (ogImage is optional). */
export interface PostFrontmatter {
  title: string;
  description: string;
  /** ISO 8601 date, e.g. "2026-07-02". */
  date: string;
  /** ISO 8601 date of the last meaningful edit (freshness signal). */
  updatedAt: string;
  author: string;
  tags: string[];
  /** Absolute or root-relative OG image. Omit to use the dynamic per-post card. */
  ogImage?: string;
}

export interface Post extends PostFrontmatter {
  slug: string;
  /** Raw MDX body (frontmatter stripped) — compiled by the page with compileMDX. */
  content: string;
}

const REQUIRED: (keyof PostFrontmatter)[] = [
  "title",
  "description",
  "date",
  "updatedAt",
  "author",
  "tags",
];

function parse(fileName: string): Post {
  const slug = fileName.replace(/\.mdx$/, "");
  const raw = readFileSync(join(CONTENT_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  for (const key of REQUIRED) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Post "${slug}": missing required frontmatter field "${key}".`);
    }
  }
  if (!Array.isArray(data.tags)) {
    throw new Error(`Post "${slug}": frontmatter "tags" must be a list.`);
  }

  // gray-matter types `data` as `any`, so these assignments are plain widening, not a
  // cast — the REQUIRED check above already guaranteed the fields are present.
  return {
    slug,
    content,
    title: data.title,
    description: data.description,
    date: data.date,
    updatedAt: data.updatedAt,
    author: data.author,
    tags: data.tags,
    ...(data.ogImage ? { ogImage: data.ogImage } : {}),
  };
}

/** Slugs of every published post — for generateStaticParams + sitemap. */
export function getPostSlugs(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

/** All posts, newest first (by `date`). */
export function getAllPosts(): Post[] {
  return (
    getPostSlugs()
      .map((slug) => parse(`${slug}.mdx`))
      // ponytail: .sort() mutates, but it's the fresh array from .map() above, so safe.
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  );
}

/** One post by slug, or undefined if it doesn't exist. */
export function getPost(slug: string): Post | undefined {
  if (!getPostSlugs().includes(slug)) return undefined;
  return parse(`${slug}.mdx`);
}
