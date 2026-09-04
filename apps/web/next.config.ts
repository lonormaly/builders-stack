import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile these workspace libs from TS/JSX source — no separate build step. This is
  // what makes `@stack/ui` and `@stack/analytics` (a "use client" provider) "just work".
  transpilePackages: ["@stack/ui", "@stack/analytics"],

  // Pin the workspace root to the repo. Without this, Next can guess the wrong root when
  // a stray lockfile exists higher up ($HOME), resolve a second React copy from there, and
  // crash prerendering with "Objects are not valid as a React child" (dual React).
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),

  // Baseline security headers on every response. No CSP here — a real CSP needs a per-app
  // nonce + allowlist (PostHog, Clarity, Tailwind inline styles) and should be added via
  // middleware once tuned; these are the zero-risk headers that never break rendering.
  // ponytail: this block is duplicated in landing/blog next.config — centralize into a
  // shared module only if a 4th app appears (workspace-TS import in next.config is fragile).
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
