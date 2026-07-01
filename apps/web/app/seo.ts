// This app's canonical origin. Env-driven — NEVER hardcode a production domain.
// `NEXT_PUBLIC_SITE_URL` is the web app's public URL; localhost is a dev-only fallback.
// (The richer, annotated AI-crawler roster lives in apps/landing/app/seo.ts — the
// marketing site is the surface you most want AI engines to read. This app keeps a
// lighter policy: allow all, don't index the auth screen.)
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
