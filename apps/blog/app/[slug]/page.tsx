import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { articleJsonLd, breadcrumbJsonLd, JsonLd, pageMetadata } from "@stack/seo";
import { Badge } from "@stack/ui";
import { getPost, getPostSlugs } from "../../lib/posts";
import { SITE_URL } from "../seo";

// Fully static: one page per post, prerendered at build. No runtime data fetching.
export function generateStaticParams(): { slug: string }[] {
  return getPostSlugs().map((slug) => ({ slug }));
}

// Per-post canonical metadata via the one door — title/description/canonical/OG per post.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: `/${post.slug}`,
    ...(post.ogImage ? { image: post.ogImage } : {}),
  });
}

// Minimal MDX → design-system element map. Keeps posts on-brand without a bespoke
// component per post (and without pulling in @tailwindcss/typography).
// jsx-a11y note: these are MDX element *overrides* — MDX passes the heading/anchor
// text in as `children` via `{...props}`, which the static a11y rule can't see, so it
// false-positives on has-content. The rendered output always has content. Disabling the
// three has-content rules at these exact spots keeps the a11y gate strict everywhere else.
const mdxComponents = {
  h2: (props: React.ComponentProps<"h2">) => (
    // oxlint-disable-next-line jsx-a11y/heading-has-content
    <h2 className="mt-12 mb-4 text-2xl font-semibold tracking-tight" {...props} />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    // oxlint-disable-next-line jsx-a11y/heading-has-content
    <h3 className="mt-8 mb-3 text-xl font-semibold tracking-tight" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="my-4 leading-7 text-foreground/90" {...props} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content
    <a className="font-medium text-primary underline underline-offset-4" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="my-4 list-disc space-y-2 pl-6 text-foreground/90" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-foreground/90" {...props} />
  ),
  li: (props: React.ComponentProps<"li">) => <li className="leading-7" {...props} />,
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-6 border-l-4 border-border pl-4 italic text-muted-foreground"
      {...props}
    />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...props} />
  ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre className="my-6 overflow-x-auto rounded-lg bg-muted p-4 text-sm" {...props} />
  ),
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { content } = await compileMDX({
    source: post.content,
    components: mdxComponents,
  });

  const url = `${SITE_URL}/${post.slug}`;
  const structuredData = [
    articleJsonLd({
      headline: post.title,
      url,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updatedAt,
      authorName: post.author,
      ...(post.ogImage ? { image: post.ogImage } : {}),
    }),
    breadcrumbJsonLd([
      { name: "Blog", url: `${SITE_URL}/` },
      { name: post.title, url },
    ]),
  ];

  return (
    <article className="mx-auto flex max-w-2xl flex-col px-6 py-16">
      <JsonLd data={structuredData} />

      <Link href="/" className="mb-8 text-sm text-muted-foreground hover:text-foreground">
        ← All posts
      </Link>

      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden>·</span>
          <span>{post.author}</span>
          {post.updatedAt !== post.date ? (
            <>
              <span aria-hidden>·</span>
              <span>Updated {formatDate(post.updatedAt)}</span>
            </>
          ) : null}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">{post.title}</h1>
        <p className="text-lg text-muted-foreground">{post.description}</p>
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </header>

      <div>{content}</div>
    </article>
  );
}
