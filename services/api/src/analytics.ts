import { PostHog } from "posthog-node";
// Shared event catalog — same names/types the client's `track` uses. Type-only import
// from the /events subpath (import-safe: no browser SDK reaches this server module).
import type { AnalyticsEvent, EventProps } from "@stack/analytics/events";

const KEY = process.env.POSTHOG_API_KEY;
const HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

// ponytail: one server-side PostHog client per process, created lazily and only
// when a key exists — so `import`ing this never throws and the API boots keyless.
// (libs/auth's signup hook keeps its own twin; extract @stack/analytics on a 3rd.)
let client: PostHog | null | undefined;
export function getPostHogServer(): PostHog | null {
  if (client === undefined) {
    client = KEY ? new PostHog(KEY, { host: HOST }) : null;
  }
  return client;
}

/**
 * Fire a server-side product event (no-op without POSTHOG_API_KEY). Typed against the
 * shared catalog: the event name + payload must match @stack/analytics/events.
 */
export function captureServer<E extends AnalyticsEvent>(
  distinctId: string,
  event: E,
  properties: EventProps<E>,
): void {
  getPostHogServer()?.capture({ distinctId, event, properties });
}

/** Send a caught exception to PostHog error tracking (no-op without a key). */
export function captureServerException(error: unknown, distinctId?: string): void {
  getPostHogServer()?.captureException(error, distinctId);
}
