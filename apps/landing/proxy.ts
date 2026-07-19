// proxy.ts — per-request nonce-based CSP (the follow-up promised in next.config.ts).
// (`proxy` is Next 16's name for the old middleware.ts convention.)
//
// How it works (official Next pattern): generate a nonce per request and put the CSP in
// BOTH the request headers (Next reads it during SSR, tags its own bootstrap/hydration
// scripts with the nonce, and switches matched routes to dynamic rendering) and the
// response headers (what the browser actually enforces).
//
// Trade-off, on purpose: a nonce means per-request HTML, so matched routes render
// dynamically — static optimization is off for pages (assets under _next/static are
// excluded by the matcher and stay static/cached). If a page must stay fully static,
// exclude it in the matcher and accept that it ships without CSP.
//
// Policy notes:
// - script-src: nonce + 'strict-dynamic'. Next's nonce'd scripts may load their own
//   chunks, and the consent-gated trackers (posthog-js's lazy session-replay loader,
//   Clarity's injected tag — see @stack/analytics) are dynamically-created scripts,
//   which 'strict-dynamic' trusts transitively. 'unsafe-inline' + https: are IGNORED
//   by every 'strict-dynamic'-capable browser — they are the graceful fallback for
//   ancient ones, not a hole.
// - style-src 'unsafe-inline': Tailwind + Next inject runtime <style> with no nonce
//   path. Scripts are the XSS execution vector; inline styles are the accepted residual.
// - connect-src: PostHog ingest/assets + Clarity beacons, driven by the same
//   NEXT_PUBLIC_POSTHOG_HOST the analytics lib uses.
// - JSON-LD <script type="application/ld+json"> is data, never executed — CSP does not
//   block it, no nonce needed (see @stack/seo).
// - Any future inline scripts (none in this app today) would read the
//   nonce from the x-nonce request header via next/headers (see apps/web popup-complete).
//
// ponytail: this file is duplicated from apps/web (same rule as the headers() block in
// next.config.ts — centralize only if a 4th app appears).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    `connect-src 'self' ${POSTHOG_HOST} https://*.i.posthog.com https://*.posthog.com https://*.clarity.ms`,
    // Prod only: on http://localhost this would upgrade same-origin subresources to
    // https and break local dev.
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except Next's static assets; skip router prefetches (they reuse the
      // page response and must not burn a nonce).
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
