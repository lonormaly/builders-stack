// Client door for @stack/analytics — pulls the "use client" provider, so use this
// from app UI only. The isomorphic event catalog + typed `track` are re-exported here
// for client convenience; SERVER code must import them from "@stack/analytics/events"
// (import-safe, no client SDK) — the barrel below loads the browser provider.
export { Analytics } from "./analytics";
// GDPR consent: the wired banner (drop next to <Analytics/>) + the consent state helpers.
// Analytics stay dormant until grantConsent() runs — see consent.ts + analytics.tsx.
export { ConsentBanner } from "./consent-banner";
export { getConsent, hasConsent, grantConsent, denyConsent, CONSENT_EVENT } from "./consent";
export type { ConsentDecision } from "./consent";
export { track } from "./events";
export type { AnalyticsEvents, AnalyticsEvent, EventProps } from "./events";
