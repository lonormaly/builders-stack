// Dodo Payments checkout — INLINE (embedded) mode, on-domain, with a hosted
// fallback. The customer pays inside an iframe the SDK mounts into your own DOM
// element (Apple Pay is supported in inline/hosted mode, NOT in overlay mode —
// confirmed by Dodo support). On success the SDK emits a redirect event; with
// manualRedirect we own it and go straight to our own success page.
//
// The SDK is dynamically imported so it never touches SSR / static export
// (client-only). This module is the SINGLE place the SDK is initialized and
// mounted — keep it that way; the modal component is the one caller.

import type { CheckoutMode, ThemeConfig } from "dodopayments-checkout";

// Where we send the customer after a successful payment — your success page.
// A relative path is env-agnostic (works on preview and prod alike). The query
// param lets that page know it arrived from a completed checkout.
const RETURN_PATH = "/thanks?checkout_id=dodo";

// Fallback height for the inline mount before the iframe reports its real size.
const DEFAULT_INLINE_HEIGHT = 420;

// ─────────────────────────────────────────────────────────────────────────────
// THEME — literal hexes are REQUIRED. The payment form is Dodo's cross-origin
// iframe: it CANNOT read your CSS variables, so map your design tokens to hex
// here at build time. The SDK themes colors + radius (+ font size/weight) but
// NOT font family — the iframe can't load your fonts, so type stays Dodo's
// default. Neutral placeholder palette below — swap for your design tokens.
// ─────────────────────────────────────────────────────────────────────────────
const THEME: ThemeConfig = {
  radius: "4px", // your --radius
  light: {
    bgPrimary: "#fafafa", // page background
    bgSecondary: "#ffffff", // card / surface
    borderPrimary: "#e5e5e5", // hairline borders
    borderSecondary: "#d4d4d4",
    // READABILITY: every text token that lands on the light bg MUST be a dark
    // color, never white/near-white — Dodo's defaults can render light text on
    // a light surface if you only theme the backgrounds.
    textPrimary: "#171717", // near-black body text
    textSecondary: "#525252", // muted text
    textPlaceholder: "#737373", // still dark enough on the light bg
    buttonPrimary: "#111111", // near-black primary pay button
    buttonPrimaryHover: "#262626",
    buttonTextPrimary: "#ffffff", // white — sits on the dark button, so it's correct
    buttonSecondary: "#f5f5f5",
    buttonSecondaryHover: "#e5e5e5",
    buttonTextSecondary: "#171717",
    inputFocusBorder: "#111111",
  },
};

// The only hosts the Dodo inline SDK accepts. A non-Dodo URL (e.g. another
// payment provider's checkout in some environments) must NOT be fed to the
// SDK — it throws "URL must be a Dodo Payments checkout domain".
const DODO_CHECKOUT_HOSTS = ["checkout.dodopayments.com", "test.checkout.dodopayments.com"];

// Is this a Dodo checkout URL (→ embed inline) or something else (→ plain
// redirect)? Keeps the caller provider-agnostic: only Dodo embeds; anything
// else degrades to its own hosted page instead of crashing the SDK.
export function isDodoCheckoutUrl(url: string): boolean {
  try {
    return DODO_CHECKOUT_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Navigating directly to the raw checkout URL loads the provider's HOSTED page
// (Dodo's hosted page supports Apple Pay). The bulletproof fallback for any
// inline failure, AND the path for non-Dodo URLs that we don't embed.
export function redirectToHostedCheckout(checkoutUrl: string): void {
  window.location.assign(checkoutUrl);
}

let initialized = false;
// The imported SDK, kept so closeDodoCheckout() can reset between checkouts.
let _sdk: { Checkout: { open: (o: unknown) => void; close: () => void } } | null = null;

// Close any open Dodo checkout. The SDK is a singleton that tracks ONE open
// checkout; opening a SECOND time (e.g. two purchase flows in the same
// session) silently no-ops with "Checkout is already open" and the new iframe
// never mounts. Call this before opening, and on unmount, so each open is clean.
export function closeDodoCheckout(): void {
  try {
    _sdk?.Checkout.close();
  } catch {
    /* nothing open */
  }
}

// Initialize's onEvent is global + registered once, but each mount needs its
// own callbacks. The global onEvent dispatches to whichever mount is currently
// active. Only one inline checkout is ever live at a time.
type ActiveMount = {
  onReady?: () => void;
  onResize?: (height: number) => void;
  onError?: () => void;
};
let active: ActiveMount | null = null;

export async function openDodoCheckoutInline(opts: {
  checkoutUrl: string;
  elementId: string;
  onReady?: () => void;
  onResize?: (height: number) => void;
  onError?: () => void;
}): Promise<void> {
  const { checkoutUrl, elementId, onReady, onResize, onError } = opts;
  try {
    // Mode is inferred from the URL host (test.checkout… vs checkout…), so the
    // client needs no public env var. One deployment is single-mode, so
    // Initialize-once is sufficient.
    const mode: CheckoutMode = new URL(checkoutUrl).hostname.startsWith("test.") ? "test" : "live";
    const { DodoPayments } = await import("dodopayments-checkout");
    _sdk = DodoPayments as unknown as typeof _sdk;

    if (!initialized) {
      DodoPayments.Initialize({
        mode,
        displayType: "inline",
        onEvent: (e) => {
          switch (e.event_type) {
            case "checkout.redirect":
            case "checkout.redirect_requested":
              // SUCCESS — Dodo has NO checkout.success event; the redirect
              // event IS success. With manualRedirect we own the navigation
              // → go straight to our own success page.
              window.location.assign(RETURN_PATH);
              break;
            // Any of these prove the embedded form is alive. form_ready alone
            // is NOT reliably delivered in inline mode, so we also accept
            // opened / payment_page_opened (and the caller should treat the
            // first resize as ready too) — otherwise the loader hangs and any
            // fallback timer fires for no reason.
            case "checkout.form_ready":
            case "checkout.opened":
            case "checkout.payment_page_opened":
              active?.onReady?.();
              break;
            case "checkout.resize": {
              // Read the reported iframe height defensively (payload shape is
              // Record<string, unknown>); fall back to the default minHeight.
              const h = Number(e.data?.height);
              active?.onResize?.(Number.isFinite(h) && h > 0 ? h : DEFAULT_INLINE_HEIGHT);
              break;
            }
            case "checkout.error":
              // NOTE: checkout.error also fires for RECOVERABLE in-form events
              // after mount (e.g. a dismissed Apple Pay sheet) — the caller
              // should only treat it as fatal before the form is ready.
              console.error("Dodo checkout error", e.data);
              active?.onError?.();
              break;
            default:
              break;
          }
        },
      });
      initialized = true;
    }

    // Reset any checkout left open by a prior flow this session, else this open
    // no-ops ("Checkout is already open") and the new form never mounts.
    closeDodoCheckout();
    active = { onReady, onResize, onError };
    DodoPayments.Checkout.open({
      checkoutUrl, // raw session url — the SDK builds the /inline URL + embeds the iframe
      elementId, // REQUIRED for inline: id of the mounted <div> target
      options: {
        showTimer: false,
        showSecurityBadge: true,
        manualRedirect: true,
        themeConfig: THEME,
      },
    });
  } catch (err) {
    // Any init/import/open failure → the caller falls back to hosted.
    console.error("Dodo inline checkout failed to open", err);
    onError?.();
    throw err;
  }
}
