"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";

// Client island: Buy button → POST /api/examples/dodo-checkout → embed the
// returned checkout url in the white-label CheckoutModal.
export default function BuyDemo() {
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/examples/dodo-checkout", { method: "POST" });
      if (!res.ok) throw new Error(`Checkout failed (${res.status})`);
      const { url } = (await res.json()) as { url: string };
      setCheckoutUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={buy}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px 32px",
          border: "none",
          borderRadius: 4,
          background: "#111",
          color: "#fff",
          fontSize: 13,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Preparing checkout…" : "Buy now"}
      </button>
      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 12, color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {checkoutUrl && (
        <CheckoutModal checkoutUrl={checkoutUrl} onClose={() => setCheckoutUrl(null)} />
      )}
    </>
  );
}
