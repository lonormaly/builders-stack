"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import Clarity from "@microsoft/clarity";
import { hasConsent, CONSENT_EVENT } from "./consent";

// Shared client analytics for EVERY app in the monorepo (apps/web, apps/landing, …).
// Drop <Analytics> into the root layout once; behaviour is identical everywhere.
//
// NEXT_PUBLIC_* are inlined at build time. All three keys are optional: with none
// set, nothing initializes and the app renders exactly as before (silent no-op).
//
// GDPR — CONSENT-GATED: even WITH keys, no tracker initializes until the user grants
// consent (see consent.ts + <ConsentBanner/>). Default = no consent → PostHog + Clarity
// stay fully dormant (no init, no cookies, no network). The provider still wraps the tree
// so `track()` calls are safe no-ops; they only reach PostHog once trackers start.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

// Module-scoped guard so React StrictMode's double-effect (dev) can't double-init.
let started = false;

// Actually boot the trackers. Called ONLY after consent is confirmed granted.
function startTrackers(): void {
  if (started) return;
  started = true;

  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: "2025-05-24", // modern autocapture + pageview/pageleave defaults
      capture_exceptions: true, // error tracking (exception autocapture)
      session_recording: { maskAllInputs: true }, // session replay (mask inputs by default)

      // Cross-domain identity: write the id cookie on the PARENT domain so a
      // visitor on the marketing origin (landing.example.com) and the signed-up
      // user in the app (app.example.com) resolve to ONE PostHog person — the
      // full acquisition funnel. No-op on localhost / single-host dev.
      cross_subdomain_cookie: true,
      persistence: "localStorage+cookie",
    });
  }

  // Microsoft Clarity session recording — independent of PostHog, same env gate.
  if (CLARITY_ID) Clarity.init(CLARITY_ID);
}

export function Analytics({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Already consented (e.g. a returning visitor) → start now.
    if (hasConsent()) {
      startTrackers();
      return;
    }
    // Otherwise stay dormant and wait: the banner dispatches CONSENT_EVENT on accept,
    // and we boot trackers then — no page refresh needed.
    const onConsentChange = () => {
      if (hasConsent()) startTrackers();
    };
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange);
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
