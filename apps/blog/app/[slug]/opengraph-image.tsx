import { ImageResponse } from "next/og";
import { brand, colors } from "@stack/ui/tokens";
import { getPost, getPostSlugs } from "../../lib/posts";

// Dynamic per-post 1200×630 card — the post's own title on the brand gradient. Next
// prerenders one per slug (generateStaticParams) so it stays fully static.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Builder's Stack Blog post";

export function generateStaticParams(): { slug: string }[] {
  return getPostSlugs().map((slug) => ({ slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  const title = post?.title ?? "Builder's Stack Blog";
  const author = post?.author ?? "builders-stack";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: `linear-gradient(135deg, ${colors.dark.background} 0%, ${brand[950]} 100%)`,
        color: colors.dark.foreground,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: brand[500] }} />
        <span style={{ fontWeight: 600 }}>Builder&apos;s Stack Blog</span>
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: 1000,
          display: "flex",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 26, color: brand[300] }}>{author}</div>
    </div>,
    { ...size },
  );
}
