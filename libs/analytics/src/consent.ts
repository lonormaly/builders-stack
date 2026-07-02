// Analytics consent (GDPR). The whole point: NO tracker initializes until the user
// grants consent. Default = no consent → PostHog + Clarity stay dormant (see analytics.tsx).
// State lives in localStorage so the decision survives reloads; a window event lets the
// live <Analytics/> provider start trackers the instant consent flips, without a refresh.
//
// Import-safe from server code (every function guards `typeof window`), so this can sit in
// the analytics barrel next to the client provider.

const KEY = "stack_analytics_consent";

/** Fired on the window when the decision changes; <Analytics/> listens to start trackers. */
export const CONSENT_EVENT = "stack:consent-change";

export type ConsentDecision = "granted" | "denied";

/** The stored decision, or `null` if the user hasn't chosen yet (→ show the banner). */
export function getConsent(): ConsentDecision | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "granted" || v === "denied" ? v : null;
}

/** True only when analytics may run. This is the single gate analytics.tsx checks. */
export function hasConsent(): boolean {
  return getConsent() === "granted";
}

function set(decision: ConsentDecision): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, decision);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: decision }));
}

/** User accepted → trackers may start. */
export function grantConsent(): void {
  set("granted");
}

/** User declined → trackers stay off (and the choice is remembered). */
export function denyConsent(): void {
  set("denied");
}
