// Payment provider abstraction. One typed interface, a real Creem implementation,
// a second Dodo implementation (starter skeleton — proof the adapter is vendor-swappable),
// and a Mock for local dev / tests. resolveProvider picks one from env (PAYMENT_PROVIDER
// selector or *_API_KEY presence) and falls back to Mock — so the service always boots.
import * as crypto from "node:crypto";

export interface CheckoutInput {
  productId: string;
  /** Your idempotency / correlation id, echoed back on the webhook. */
  requestId?: string;
  successUrl?: string;
  customerEmail?: string;
}

export interface CheckoutResult {
  id: string;
  checkoutUrl: string;
}

/** Normalized webhook after signature verification. */
export interface WebhookEvent {
  /** e.g. "checkout.completed", "subscription.paid", "subscription.canceled". */
  eventType: string;
  object: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Returns the event if the signature is valid, else null. */
  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent | null;
}

function parseEvent(rawBody: string): WebhookEvent {
  // Creem sends { id, eventType, object, ... }.
  const body = JSON.parse(rawBody) as Record<string, unknown>;
  return {
    eventType: String(body.eventType ?? body.type ?? "unknown"),
    object: (body.object as Record<string, unknown>) ?? body,
  };
}

// ---- Creem (Merchant of Record) -------------------------------------------
// Verified against docs.creem.io:
//   POST {base}/v1/checkouts   header `x-api-key`   body { product_id, ... } → { id, checkout_url }
//   webhook: header `creem-signature` = hex HMAC-SHA256(rawBody, CREEM_WEBHOOK_SECRET)
// Key prefix selects env: `creem_test_` → sandbox, otherwise production.
// ponytail: thin fetch client (2 calls). Official `creem` npm SDK can drop in behind
// this same interface if you want typed models — the REST contract below is verified.
export class CreemProvider implements PaymentProvider {
  readonly name = "creem";
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string | undefined,
    baseUrl?: string,
  ) {
    this.baseUrl =
      baseUrl ??
      (apiKey.startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io");
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${this.baseUrl}/v1/checkouts`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: input.productId,
        request_id: input.requestId,
        success_url: input.successUrl,
        customer: input.customerEmail ? { email: input.customerEmail } : undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`Creem checkout failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string; checkout_url: string };
    return { id: data.id, checkoutUrl: data.checkout_url };
  }

  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent | null {
    if (!this.webhookSecret || !signature) return null;
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return parseEvent(rawBody);
  }
}

// ---- Dodo Payments (Merchant of Record) -----------------------------------
// STARTER SKELETON — wire this up, it is NOT a tested integration.
// Dodo (https://dodopayments.com, https://docs.dodopayments.com) is a real MoR,
// a second vendor behind the SAME PaymentProvider interface — proof the adapter
// is swappable. The structure + types are real and typecheck; the two spots that
// hit Dodo's HTTP API are marked `TODO(dodo)` because we don't have live specs
// pinned here (unlike Creem, whose REST contract above is verified). Fill those
// in against the docs, keep everything else, and it drops in behind resolveProvider.
// verifyWebhook uses the same hex HMAC-SHA256 pattern as Creem as a working
// starting point; confirm Dodo's exact signature scheme + header before going live.
export class DodoProvider implements PaymentProvider {
  readonly name = "dodo";
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string | undefined,
    baseUrl?: string,
  ) {
    // Test keys hit the sandbox; live keys hit production. Adjust the prefix/hosts
    // to Dodo's real convention when wiring up.
    this.baseUrl =
      baseUrl ??
      (apiKey.startsWith("dodo_test_")
        ? "https://test.dodopayments.com"
        : "https://live.dodopayments.com");
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // TODO(dodo): call the real Dodo API — https://docs.dodopayments.com
    // Shape below mirrors the Creem call (auth header + JSON body → { id, url });
    // replace the path, auth header, request/response field names with Dodo's real
    // contract, then delete this comment. Kept as a real fetch so the wiring is
    // obvious and the method stays honestly async.
    const res = await fetch(`${this.baseUrl}/v1/checkouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: input.productId,
        request_id: input.requestId,
        return_url: input.successUrl,
        customer: input.customerEmail ? { email: input.customerEmail } : undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`Dodo checkout failed (${res.status}): ${await res.text()}`);
    }
    // TODO(dodo): map to Dodo's real response fields (id + hosted checkout url).
    const data = (await res.json()) as { id: string; checkout_url: string };
    return { id: data.id, checkoutUrl: data.checkout_url };
  }

  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent | null {
    // TODO(dodo): confirm Dodo's real signature scheme + header name against the
    // docs. This hex HMAC-SHA256 over the raw body is the same pattern Creem uses
    // and is a correct, timing-safe starting point.
    if (!this.webhookSecret || !signature) return null;
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return parseEvent(rawBody);
  }
}

// ---- Mock (local dev / tests) ---------------------------------------------
// No network, no signature check — trusts the payload so you can exercise the
// /checkout and /webhook flows without Creem credentials.
export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const id = `mock_${crypto.randomUUID()}`;
    const url = new URL("https://mock.checkout.local/pay");
    url.searchParams.set("session", id);
    url.searchParams.set("product", input.productId);
    if (input.successUrl) url.searchParams.set("success_url", input.successUrl);
    return { id, checkoutUrl: url.toString() };
  }

  verifyWebhook(rawBody: string): WebhookEvent | null {
    try {
      return parseEvent(rawBody);
    } catch {
      return null;
    }
  }
}

/**
 * Multi-vendor, env-gated selection. Resolution order:
 *   1. Explicit selector: PAYMENT_PROVIDER=creem|dodo|mock wins if set.
 *   2. Otherwise auto-detect by which key is present: CREEM_API_KEY → Creem,
 *      DODO_API_KEY → Dodo.
 *   3. Nothing configured → Mock, so the service always boots keyless.
 * Adding a third vendor is one case here + one class above — apps never change,
 * they only ever call the PaymentProvider interface. See docs/stack/payments.md.
 */
export function resolveProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const selector = env.PAYMENT_PROVIDER?.toLowerCase();

  if (selector === "mock") return new MockProvider();
  if (selector === "creem" || (!selector && env.CREEM_API_KEY)) {
    if (!env.CREEM_API_KEY) throw new Error("PAYMENT_PROVIDER=creem but CREEM_API_KEY is unset");
    return new CreemProvider(env.CREEM_API_KEY, env.CREEM_WEBHOOK_SECRET);
  }
  if (selector === "dodo" || (!selector && env.DODO_API_KEY)) {
    if (!env.DODO_API_KEY) throw new Error("PAYMENT_PROVIDER=dodo but DODO_API_KEY is unset");
    return new DodoProvider(env.DODO_API_KEY, env.DODO_WEBHOOK_SECRET);
  }
  return new MockProvider();
}
