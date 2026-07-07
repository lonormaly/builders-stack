// server-create-checkout.ts — server-side Dodo Payments checkout session creation.
//
// Uses the official `dodopayments` server SDK (Stainless, fetch-based — works in
// Node and edge runtimes like Cloudflare Workers under nodejs_compat). Only the
// resulting `checkout_url` should ever reach the browser; the API key never does.
//
// Env:
//   DODO_ACCESS_TOKEN  — API key (Dodo dashboard → Developer → API Keys)
//   DODO_SERVER        — "test" | "live"
//   APP_URL            — your app's public origin, e.g. https://yourapp.com
//   DODO_DEMO_PRODUCT_ID — optional; see ensureDemoProduct()

import DodoPayments from "dodopayments";

// Lazily built singleton — the SDK throws on a missing bearer token, so don't
// construct it at module load (import-time crash on unconfigured environments).
// The SDK derives the base URL from `environment` — no hardcoded hosts.
let _client: DodoPayments | null = null;
function client(): DodoPayments {
  if (!process.env.DODO_ACCESS_TOKEN?.trim()) {
    throw new Error("DODO_ACCESS_TOKEN is not set");
  }
  if (!_client) {
    _client = new DodoPayments({
      bearerToken: process.env.DODO_ACCESS_TOKEN.trim(),
      environment: process.env.DODO_SERVER === "test" ? "test_mode" : "live_mode",
    });
  }
  return _client;
}

export async function createCheckoutSession(opts: {
  productId: string;
  customerEmail: string;
  customerName?: string;
  metadata?: Record<string, string>;
}): Promise<{ url: string }> {
  if (!process.env.APP_URL) throw new Error("APP_URL is not set");

  // Some fields below (`minimal_address`, `feature_flags`) are honored by the
  // POST /checkouts endpoint but not modeled in the SDK's params type, so the
  // body is cast. Stainless serializes it verbatim (it never strips unknown
  // keys), so the wire request carries them fine.
  const checkout = await client().checkoutSessions.create({
    product_cart: [{ product_id: opts.productId, quantity: 1 }],
    // Explicitly allow the wallets you want. Without this Dodo falls back to a
    // default set that OMITS Apple Pay. (Apple Pay also needs your domain
    // verified with Apple via Dodo — host their association file at
    // /.well-known/apple-developer-merchantid-domain-association and ask
    // support if it still doesn't render.)
    allowed_payment_method_types: ["apple_pay", "google_pay", "credit", "debit"],
    // Identity passthrough — this metadata is echoed on the payment (and
    // subscription) object in EVERY webhook, so your handler can resolve your
    // own user/order with a one-field read. No mapping table needed.
    metadata: opts.metadata ?? {},
    customer: {
      email: opts.customerEmail,
      ...(opts.customerName ? { name: opts.customerName } : {}),
    },
    // Keep the buyer's name editable on the form even when prefilled (Dodo
    // locks attached-customer fields by default; this flag re-opens the input).
    feature_flags: { allow_customer_editing_name: true },
    // Collect only country + ZIP — the tax minimum for a Merchant of Record —
    // instead of a full street/city/state form. Fewer fields, better conversion.
    minimal_address: true,
    // Returning customers see their saved card.
    show_saved_payment_methods: true,
    // Where the customer lands after payment. Your success page can key off
    // the query param to show its own celebration UI.
    return_url: `${process.env.APP_URL}/thanks?checkout_id=dodo`,
  } as unknown as Parameters<DodoPayments["checkoutSessions"]["create"]>[0]);

  if (!checkout.checkout_url) throw new Error("Dodo returned no checkout_url");
  return { url: checkout.checkout_url };
}

// ── Demo helper — for demos/tests ONLY, not production code ──────────────────
// Lets this example run with nothing but a test API key: if you haven't
// pre-created a product, it creates a $10 one-time test product and returns its
// id. Set DODO_DEMO_PRODUCT_ID to skip creation (and avoid piling up products
// on repeated runs).
export async function ensureDemoProduct(): Promise<string> {
  if (process.env.DODO_DEMO_PRODUCT_ID) return process.env.DODO_DEMO_PRODUCT_ID;
  const product = await client().products.create({
    name: "Demo — White-label Checkout",
    tax_category: "saas",
    price: {
      type: "one_time_price",
      currency: "USD",
      price: 1000, // smallest denomination — $10.00
      discount: 0,
      purchasing_power_parity: false,
    },
  });
  return product.product_id;
}
