"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  closeDodoCheckout,
  isDodoCheckoutUrl,
  openDodoCheckoutInline,
  redirectToHostedCheckout,
} from "./dodo-checkout";

// A self-contained checkout modal: your overlay + panel around Dodo's embedded
// payment iframe. It renders a skeleton loader (pulsing bars — no spinner)
// until the iframe reports ready, then the embedded form grows to the
// reported height.
//
// STAY-INLINE POLICY: NEVER auto-redirect a slow checkout to the hosted page —
// the customer pays ON your domain so Apple Pay / Google Pay render
// in-context. The embedded SDK reliably mounts but can be slow (~7-9s to first
// event), so a short timer would bounce customers out prematurely. Instead:
// give the mount a generous deadline, and if it still hasn't reported ready
// (or errors before mounting), show an INLINE retry — stay on-domain. A manual
// "Open secure payment page" link is offered as a user-initiated escape hatch
// only — never an automatic redirect.
//
// Success navigation is owned by dodo-checkout.ts (the checkout.redirect
// handler) — this component never handles success.

// Generous: the embedded form is reliably slow to report ready. We are NOT
// redirecting on this deadline (we show an inline retry), so erring long is
// safe — it just delays when the retry affordance appears for a stuck mount.
const READY_DEADLINE_MS = 20000;
const DEFAULT_HEIGHT = 420;

export function CheckoutModal({
  checkoutUrl,
  onClose,
}: {
  checkoutUrl: string;
  onClose: () => void;
}) {
  // Stable, DOM-valid id (useId() yields ":r0:" which isn't a valid selector).
  const elementId = `dodo_inline_${useId().replace(/:/g, "_")}`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  // Bumping this re-runs the mount effect (the Retry button increments it).
  const [attempt, setAttempt] = useState(0);
  // Mirrors `ready` for the event handlers (which close over the render) —
  // decides whether a checkout.error is a FATAL pre-mount failure or a
  // RECOVERABLE in-form error (see onError below).
  const readyRef = useRef(false);
  // The native <dialog> element — showModal() gives a real focus trap + ::backdrop.
  const dialogRef = useRef<HTMLDialogElement>(null);

  const mount = useCallback(() => {
    // Guard: the inline SDK throws on non-Dodo hosts. A mis-wired URL
    // degrades to a plain redirect instead of a crash.
    if (!isDodoCheckoutUrl(checkoutUrl)) {
      redirectToHostedCheckout(checkoutUrl);
      return () => {
        // Redirected to the hosted page — nothing mounted here to tear down.
      };
    }

    let cancelled = false;

    // Mount didn't report ready in time — show the inline retry. We do NOT
    // redirect (stay-inline policy); the form may still be loading behind the
    // skeleton, so the retry simply re-mounts it fresh.
    const timer = window.setTimeout(() => {
      if (cancelled || readyRef.current) return;
      setFailed(true);
    }, READY_DEADLINE_MS);

    // Mark the embedded form alive: clear the skeleton + cancel the deadline.
    // Idempotent — called from whichever signal arrives first.
    const markReady = () => {
      if (cancelled || readyRef.current) return;
      window.clearTimeout(timer);
      readyRef.current = true;
      setReady(true);
      setFailed(false);
    };

    void openDodoCheckoutInline({
      checkoutUrl,
      elementId,
      // form_ready is NOT reliably delivered in inline mode — don't depend on it.
      onReady: markReady,
      onResize: (h) => {
        if (cancelled) return;
        // The first resize proves the iframe mounted + measured itself. Treat
        // it as ready: without this, a missing form_ready leaves the skeleton up.
        markReady();
        setHeight(h);
      },
      onError: () => {
        if (cancelled) return;
        // checkout.error covers BOTH fatal init failures AND recoverable
        // in-form errors (the SDK emits it for "Wallet payment failed" —
        // Apple Pay declined / sheet dismissed). If the form already mounted
        // it's recoverable: leave it up so the customer can retry the wallet
        // inline — NEVER tear down a mounted form. Only a PRE-mount error
        // means the form failed to load → show the inline retry (still
        // on-domain, no auto-redirect).
        if (readyRef.current) return;
        window.clearTimeout(timer);
        setFailed(true);
      },
    }).catch(() => {
      // SDK import/open threw before mounting → inline retry, no redirect.
      if (cancelled) return;
      window.clearTimeout(timer);
      setFailed(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Close the SDK's checkout so the NEXT checkout in this session opens
      // cleanly instead of silently no-oping with "Checkout is already open"
      // (the SDK is a singleton tracking one open checkout).
      closeDodoCheckout();
    };
  }, [checkoutUrl, elementId]);

  useEffect(() => {
    // Reset per (checkoutUrl, attempt) so a Retry re-mounts cleanly.
    readyRef.current = false;
    setReady(false);
    setFailed(false);
    return mount();
  }, [mount, attempt]);

  // Open as a true modal: top layer, focus trap, and native Escape handling
  // (fires `cancel` — routed to onClose below), so no manual keydown listener.
  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);

  return (
    // Native <dialog> is the overlay: semantic, so no role/keyboard shims. Dismissal
    // is via Escape (native → onCancel) and the × button — deliberately NOT the
    // backdrop, so a stray click can't drop a customer mid-payment.
    <dialog
      ref={dialogRef}
      aria-label="Secure checkout"
      onCancel={(e) => {
        e.preventDefault(); // route Escape through onClose, don't self-close
        onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        maxHeight: "100vh",
        margin: 0,
        border: "none",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0, 0, 0, 0.5)", // swap for your design tokens
      }}
    >
      {/* Skeleton pulse — plain CSS, no spinner. */}
      <style>{`@keyframes checkout-pulse { 50% { opacity: 0.4; } }`}</style>

      {/* Panel */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: "#fff", // swap for your design tokens
          border: "1px solid #e5e5e5",
          borderRadius: 6,
          padding: "40px 32px 32px",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            color: "#666",
          }}
        >
          ×
        </button>

        {/* Skeleton loader — pulsing bars, hidden once ready or failed. */}
        {!ready && !failed && (
          <div
            aria-hidden
            style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0" }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 44,
                  width: "100%",
                  border: "1px solid #eee", // swap for your design tokens
                  background: "#f5f5f5",
                  borderRadius: 4,
                  opacity: 1 - i * 0.12,
                  animation: "checkout-pulse 2s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        )}

        {/* Inline failure — stay on-domain. Retry re-mounts the embedded form;
            the manual link is a user-initiated escape, never an automatic
            redirect. */}
        {failed && (
          <div
            role="alert"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "32px 0",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
              Loading secure checkout&hellip; Taking longer than expected.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              style={{
                padding: "12px 32px",
                border: "none",
                borderRadius: 4,
                background: "#111", // swap for your design tokens
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => redirectToHostedCheckout(checkoutUrl)}
              style={{
                border: "none",
                background: "none",
                textDecoration: "underline",
                fontSize: 12,
                color: "#888",
                cursor: "pointer",
              }}
            >
              Open secure payment page
            </button>
          </div>
        )}

        {/* Mount target — the SDK embeds the checkout iframe here. minHeight
            grows to the reported height once the form is ready. */}
        <div
          id={elementId}
          style={{ minHeight: ready ? height : 0, transition: "min-height 0.4s ease" }}
        />
      </div>
    </dialog>
  );
}

export default CheckoutModal;
