import os from "node:os";
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

  // Workaround for vercel/next.js#94432. This repo's bunfig.toml (`linker =
  // "isolated"`, `globalStore = true`) installs every package once into a
  // shared store under the home directory and symlinks each checkout to it.
  // Turbopack's project boundary otherwise defaults to `outputFileTracingRoot`
  // above, which sits below that store, so it refuses to follow the symlinks
  // ("Symlink … points out of the filesystem root") and `next build` fails —
  // reproduced identically on a local machine and a fresh GitHub Actions
  // runner. Widening the boundary to the home directory (the common ancestor
  // of both the repo and the store) fixes it without giving up Turbopack.
  // Remove once vercel/next.js#94432 ships upstream, or if this repo stops
  // using Bun's isolated linker + global store. See docs/stack/known-issues.md.
  turbopack: {
    root: os.homedir(),
  },

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
