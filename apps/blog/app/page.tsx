import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@stack/ui";
import { breadcrumbJsonLd, JsonLd, pageMetadata, webPageJsonLd, websiteJsonLd } from "@stack/seo";
import { getAllPosts } from "../lib/posts";
import { BLOG_DESCRIPTION, BLOG_NAME, SITE_URL } from "./seo";

// This page's canonical metadata — one door (@stack/seo). Layout owns the site default
// + `%s` template; this pins the "/" canonical + OG for the index route. markdownMirror:
// true wires <link rel="alternate" type="text/markdown"> — the mirror itself is served
// by app/api/md/[...path]/route.ts (see docs/stack/agent-readability.md).
export const metadata = pageMetadata({
  description: BLOG_DESCRIPTION,
  tagline: "field notes from an AI-native monorepo",
  path: "/",
  markdownMirror: true,
});

// Where the header links back to — the marketing site. Env-driven, never hardcoded.
const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "http://landing.stack.localhost:1355";
// The flagship app, whose /glossary defines terms used across this blog. Same default
// apps/web and apps/landing use.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();
  const newest = posts[0]?.updatedAt ?? new Date().toISOString().slice(0, 10);

  // Rich-results + agent-readability structured data for the index: the site, a
  // WebPage (dateModified + description) per the agent-readability spec, and a
  // breadcrumb. Article JSON-LD lives on each post page, not here.
  const structuredData = [
    websiteJsonLd({ name: BLOG_NAME, url: SITE_URL, description: BLOG_DESCRIPTION }),
    webPageJsonLd({
      name: "Field notes",
      url: SITE_URL,
      description: BLOG_DESCRIPTION,
      dateModified: newest,
    }),
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
        <h2 className="text-xl font-semibold tracking-tight">Latest posts</h2>
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

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Follow along</h2>
        <p className="max-w-2xl text-muted-foreground">
          Every post is static MDX, server-rendered, and served with a markdown mirror for agents
          (append <code>.md</code> to any post URL, or send <code>Accept: text/markdown</code>).
          Subscribe via the RSS feed, or read{" "}
          <a href={`${SITE_URL}/AGENTS.md`} className="underline underline-offset-4">
            AGENTS.md
          </a>{" "}
          for how this blog is put together.
        </p>
      </section>

      <footer className="pb-8 text-center text-sm text-muted-foreground">
        <a href={`${SITE_URL}/feed.xml`} className="hover:text-foreground">
          RSS feed
        </a>{" "}
        ·{" "}
        <a href={`${APP_URL}/glossary`} className="hover:text-foreground">
          Glossary
        </a>{" "}
        · MIT. Steal it, ship faster.
      </footer>
    </div>
  );
}
