import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile these workspace libs from TS/JSX source — no separate build step (mirrors
  // apps/landing). @stack/analytics is a "use client" provider; @stack/ui is the design
  // system. next-mdx-remote runs at build time (SSG) so no MDX webpack loader needed.
  transpilePackages: ["@stack/ui", "@stack/analytics"],

  // Pin the workspace root so Next doesn't guess it from a stray lockfile higher up
  // (which resolves a second React copy and crashes prerendering).
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),

  // Baseline security headers — see apps/web/next.config.ts for the CSP/centralization note.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
