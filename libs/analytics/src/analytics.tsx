"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import Clarity from "@microsoft/clarity";

// Shared client analytics for EVERY app in the monorepo (apps/web, apps/landing, …).
// Drop <Analytics> into the root layout once; behaviour is identical everywhere.
//
// NEXT_PUBLIC_* are inlined at build time. All three keys are optional: with none
// set, nothing initializes and the app renders exactly as before (silent no-op).
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

// Module-scoped guard so React StrictMode's double-effect (dev) can't double-init.
let started = false;

export function Analytics({ children }: { children: ReactNode }) {
  useEffect(() => {
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
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
