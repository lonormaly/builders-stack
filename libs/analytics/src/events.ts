// Typed analytics event catalog — ISOMORPHIC (no "use client"). The single source of
// truth for event NAMES and their PAYLOADS, shared by the client (<Analytics/>) and the
// server (services/api, libs/auth). Add an event here once and both sides get the type.
//
// Import-safe from server code: this module pulls NO browser SDK at load. `track` loads
// posthog-js lazily and only in the browser, so a bun/node process can import the types
// and helpers without ever touching the client library.

/** The catalog: event name → payload shape. Extend this to add events. */
export type AnalyticsEvents = {
  user_signed_up: { email: string };
  page_viewed: { path: string };

  // --- Security / audit events (SOC2 CC7: monitoring) ---
  // Emitted SERVER-side on auth actions via `securityEvent()`. They double as an audit
  // trail (structured stdout line) AND a PostHog event. Only `auth_signed_in` is wired
  // today (libs/auth session hook); the other two are ready for you to wire (see docs/soc2-readiness.md).
  auth_signed_in: Record<string, never>;
  auth_signed_out: Record<string, never>;
  auth_login_failed: { email: string };
};

/** Union of valid event names. */
export type AnalyticsEvent = keyof AnalyticsEvents;

/** Payload type for a given event. */
export type EventProps<E extends AnalyticsEvent> = AnalyticsEvents[E];

/**
 * Client-side capture. Type-safe: the props must match the event's catalog entry.
 * No-op on the server, and loads posthog-js lazily so this module stays import-safe
 * from server code.
 */
export function track<E extends AnalyticsEvent>(event: E, props: EventProps<E>): void {
  if (typeof window === "undefined") return;
  void import("posthog-js").then(({ default: posthog }) => posthog.capture(event, props));
}

/**
 * Server-side helper: builds the `{ event, properties }` payload for a posthog-node
 * `capture(...)` call, typed against the SAME catalog. Keeps names + shapes identical
 * across the wire without importing any client code.
 *
 *   posthog.capture({ distinctId, ...serverEvent("user_signed_up", { email }) })
 */
export function serverEvent<E extends AnalyticsEvent>(event: E, properties: EventProps<E>) {
  return { event, properties } as const;
}

/**
 * Audit logger for security-relevant events (sign-in/out, failed login, …). SOC2 CC7
 * (monitoring) wants a durable, tamper-evident trail — so this writes a structured JSON
 * line to stdout (picked up by ANY log aggregator, independent of PostHog) AND returns a
 * `capture()`-shaped payload so the caller can also ship it to PostHog:
 *
 *   posthog.capture(securityEvent(userId, "auth_signed_in", {}))
 *
 * Typed against the SAME catalog, so a mistyped event name / payload won't compile. This is
 * a pattern, not a SIEM — point the stdout at your log store and add alerting there.
 */
export function securityEvent<E extends AnalyticsEvent>(
  actorId: string,
  event: E,
  properties: EventProps<E>,
) {
  console.info(
    JSON.stringify({ audit: true, event, actorId, at: new Date().toISOString(), ...properties }),
  );
  return { distinctId: actorId, event, properties } as const;
}
