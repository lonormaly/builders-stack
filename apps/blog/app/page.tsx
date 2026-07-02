import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@stack/ui";
import { breadcrumbJsonLd, JsonLd, pageMetadata, websiteJsonLd } from "@stack/seo";
import { getAllPosts } from "../lib/posts";
import { BLOG_DESCRIPTION, BLOG_NAME, SITE_URL } from "./seo";

// This page's canonical metadata — one door (@stack/seo). Layout owns the site default
// + `%s` template; this pins the "/" canonical + OG for the index route.
export const metadata = pageMetadata({
  description: BLOG_DESCRIPTION,
  tagline: "field notes from an AI-native monorepo",
  path: "/",
});

// Where the header links back to — the marketing site. Env-driven, never hardcoded.
const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "http://landing.stack.localhost:1355";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  // Rich-results structured data for the index: the site + a breadcrumb. Article JSON-LD
  // lives on each post page, not here.
  const structuredData = [
    websiteJsonLd({ name: BLOG_NAME, url: SITE_URL, description: BLOG_DESCRIPTION }),
    breadcrumbJsonLd([{ name: "Blog", url: `${SITE_URL}/` }]),
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-16 px-6 py-16">
      <JsonLd data={structuredData} />

      <header className="flex items-center justify-between">
        <span className="font-semibold">Builder&apos;s Stack Blog</span>
        <a href={LANDING_URL} className="text-sm text-muted-foreground hover:text-foreground">
          ← builders-stack
        </a>
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Field notes</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{BLOG_DESCRIPTION}</p>
      </section>

      <section className="flex flex-col gap-6">
        {posts.map((post) => (
          <Card key={post.slug}>
            <CardHeader>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span aria-hidden>·</span>
                <span>{post.author}</span>
              </div>
              <CardTitle className="text-2xl">
                <Link href={`/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-muted-foreground">{post.description}</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="pb-8 text-center text-sm text-muted-foreground">
        <a href={`${SITE_URL}/feed.xml`} className="hover:text-foreground">
          RSS feed
        </a>{" "}
        · MIT. Steal it, ship faster.
      </footer>
    </div>
  );
}
