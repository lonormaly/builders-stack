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
};

export default nextConfig;
