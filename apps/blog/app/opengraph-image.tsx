import { ImageResponse } from "next/og";
import { brand, colors } from "@stack/ui/tokens";

// The default 1200×630 social card for the blog index (and any route without its own
// card). On-brand via the shared @stack/ui tokens — same palette the app renders.
export const alt = "Builder's Stack Blog — field notes from an AI-native monorepo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: brand[500] }} />
        <span style={{ fontWeight: 600 }}>Builder&apos;s Stack Blog</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
          Field notes from an AI-native monorepo.
        </div>
        <div style={{ fontSize: 30, color: colors.dark.mutedForeground, maxWidth: 820 }}>
          Structure, SEO/GEO, and the tools that keep a repo fast as it grows.
        </div>
      </div>
      <div style={{ fontSize: 24, color: brand[300] }}>builders-stack</div>
    </div>,
    { ...size },
  );
}
