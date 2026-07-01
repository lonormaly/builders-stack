// Payment provider abstraction. One typed interface, a real Creem implementation,
// and a Mock for local dev / tests. The service picks Creem when CREEM_API_KEY is
// set, else Mock — so it always boots.
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

/** Env-gated selection: Creem when a key is present, else Mock. */
export function resolveProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  if (env.CREEM_API_KEY) {
    return new CreemProvider(env.CREEM_API_KEY, env.CREEM_WEBHOOK_SECRET);
  }
  return new MockProvider();
}
