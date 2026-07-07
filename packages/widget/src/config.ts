// Pure, DOM-free config resolution — the widget's core logic, unit-tested in
// config.test.ts (no browser needed).
//
// THE NATURAL lib DEPENDENCY (the boundary proof's "accept" case): the widget
// defaults its accent color to the design-system primary from `@stack/ui/tokens`.
// A `type:package` importing a `type:lib` is legal (packages depend DOWN on libs,
// exactly like apps/services do) — and `@stack/ui/tokens` is pure data (no DOM, no
// React), so it bundles cleanly into the self-contained embed. This is a real
// downward dependency, not a contrivance: a distributable that ships your brand's
// button should ship your brand's color.
import { colors } from "@stack/ui/tokens";

export type WidgetPosition = "bottom-right" | "bottom-left";

/** What a host page passes to `mountFeedback(...)` — every field optional. */
export interface WidgetOptions {
  /** Where the collected feedback is POSTed. Required for a real embed. */
  endpoint?: string;
  /** Button label. */
  label?: string;
  /** Accent color (any CSS color). Defaults to the @stack/ui design-token primary. */
  color?: string;
  /** Corner to pin the launcher to. */
  position?: WidgetPosition;
}

/** Fully-resolved config the DOM layer renders from — no optionals left. */
export interface ResolvedConfig {
  endpoint: string;
  label: string;
  color: string;
  position: WidgetPosition;
}

export const DEFAULTS: ResolvedConfig = {
  endpoint: "",
  label: "Feedback",
  color: colors.light.primary,
  position: "bottom-right",
};

/** Merge host options over defaults. Pure — the seam the test pins. */
export function resolveConfig(options: WidgetOptions = {}): ResolvedConfig {
  return {
    endpoint: options.endpoint ?? DEFAULTS.endpoint,
    label: options.label ?? DEFAULTS.label,
    color: options.color ?? DEFAULTS.color,
    position: options.position ?? DEFAULTS.position,
  };
}

/** The typed payload sent to `endpoint`. What a third party receives. */
export interface FeedbackPayload {
  message: string;
  url: string;
  at: string;
}

/**
 * Guard the submit target: only fire at an https:// URL. The endpoint comes from a
 * host-controlled `data-endpoint` / `mountFeedback({endpoint})`, so a hijacked page (or
 * DOM XSS) could point it at an exfiltration URL — refuse anything that isn't HTTPS.
 * Pure, so config.test.ts pins it.
 */
export function isValidEndpoint(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Build the wire payload. Pure — also pinned by the test. */
export function buildPayload(
  message: string,
  url: string,
  now: Date = new Date(),
): FeedbackPayload {
  return { message: message.trim(), url, at: now.toISOString() };
}
