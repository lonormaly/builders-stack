---
name: wire-a-new-payment-provider
description: Add or swap a payment provider behind the @stack/payment adapter in the builders-stack monorepo. Use when integrating Stripe, Paddle, Lemon Squeezy, or any provider alongside or in place of the default Creem adapter. The whole point is that apps and the API never change — only the adapter implementation does. Covers the adapter interface, the new implementation, webhook verification, env config, and keeping the checkout contract stable.
---

# Wire a new payment provider

Payments in this repo go through **one adapter interface** in `@stack/payment`. Apps and `@stack/api` call the interface, never a provider SDK. Swapping or adding a provider means writing a new implementation of that interface — nothing upstream changes. That's the entire reason the adapter exists.

## When to use

- Replacing the default Creem adapter with Stripe/Paddle/Lemon Squeezy/etc.
- Supporting a second provider (e.g. Creem as Merchant-of-Record + Stripe for a region).
- **Not** for changing checkout copy or the button — that's app-side and touches no payment code.

## The invariant

```
apps/web ──▶ @stack/api  /checkout ──▶ @stack/payment (interface) ──▶ <provider impl>
                                            ▲ everything left of here NEVER changes
```

If your change edits an app or an API route to call a provider SDK directly, stop — you've broken the adapter. Route it through the interface.

## The interface (shape to conform to)

`@stack/payment` exposes a single door. Every provider implements the same contract:

```ts
export interface PaymentProvider {
  createCheckout(input: {
    priceId: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<{ checkoutUrl: string; sessionId: string }>;

  // Verify the signature, then return a normalized event. Throw on bad signature.
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentEvent>;
}

export type PaymentEvent =
  | {
      type: "checkout.completed";
      sessionId: string;
      customerEmail?: string;
      metadata?: Record<string, string>;
    }
  | { type: "subscription.updated"; customerId: string; status: string }
  | { type: "unknown"; raw: unknown };
```

## Steps

1. **Add the impl** in `services/payment/src/providers/<provider>.ts`, implementing `PaymentProvider`. Keep the provider SDK import confined to this file.

2. **Config, not hardcoding.** Read keys/secrets from env. Add them to `.env.example` with empty values and a comment:

   ```
   # services/payment — <Provider>
   <PROVIDER>_API_KEY=
   <PROVIDER>_WEBHOOK_SECRET=
   ```

3. **Verify webhook signatures** in `verifyWebhook` using the provider's documented scheme and `<PROVIDER>_WEBHOOK_SECRET`. **Never** trust an unverified webhook body — throw on mismatch. This is a trust boundary; do not simplify it away.

4. **Select the provider** in one place (a factory reading an env flag like `PAYMENT_PROVIDER=creem|stripe`), so switching is a config change, not a code change.

5. **Keep the routes stable.** `POST /checkout` returns `{ checkoutUrl }`; the webhook route calls `verifyWebhook` then handles the normalized `PaymentEvent`. The Bruno request `api-collection/payment/checkout.bru` must still pass unchanged — that's the contract test.

6. **Normalize, don't leak.** Map provider-specific payloads into `PaymentEvent` inside the adapter. Callers see the normalized type only.

## Verify

- `bun run typecheck` passes.
- `POST /checkout` (via `api-collection/payment/checkout.bru`) returns a `checkoutUrl` unchanged from before.
- A tampered webhook body is rejected by `verifyWebhook` (bad-signature path throws). Add one small assertion/test for that path — it's a money/security boundary.
