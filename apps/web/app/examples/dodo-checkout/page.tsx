"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";

// Minimal demo page: product card → POST /api/examples/dodo-checkout → embed
// the returned checkout url in the white-label CheckoutModal.
export default function DodoCheckoutExamplePage() {
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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 6,
          padding: 32,
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#171717" }}>Demo Product</h1>
        <p style={{ margin: "8px 0 24px", fontSize: 14, color: "#525252" }}>$10.00</p>
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
      </div>

      {checkoutUrl && (
        <CheckoutModal checkoutUrl={checkoutUrl} onClose={() => setCheckoutUrl(null)} />
      )}
    </main>
  );
}
