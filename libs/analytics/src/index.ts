// Client door for @stack/analytics — pulls the "use client" provider, so use this
// from app UI only. The isomorphic event catalog + typed `track` are re-exported here
// for client convenience; SERVER code must import them from "@stack/analytics/events"
// (import-safe, no client SDK) — the barrel below loads the browser provider.
export { Analytics } from "./analytics";
export { track } from "./events";
export type { AnalyticsEvents, AnalyticsEvent, EventProps } from "./events";
