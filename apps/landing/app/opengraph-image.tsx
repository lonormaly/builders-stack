import { ImageResponse } from "next/og";
import { colors, brand } from "@stack/ui/tokens";

// Generated 1200×630 social card. Next auto-wires this as og:image AND twitter:image
// for every route (the file-convention default). On-brand via the shared @stack/ui
// tokens — the same palette the app renders — so no drift between site and card.
export const alt = "Builder's Stack — an AI-native monorepo starter";
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
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: brand[500],
          }}
        />
        <span style={{ fontWeight: 600 }}>Builder&apos;s Stack</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
          A project structure your agent can actually navigate.
        </div>
        <div style={{ fontSize: 30, color: colors.dark.mutedForeground, maxWidth: 820 }}>
          apps · services · libs — one command, a live app, a repo that stays fast.
        </div>
      </div>
      <div style={{ fontSize: 24, color: brand[300] }}>AI-native monorepo starter</div>
    </div>,
    { ...size },
  );
}
