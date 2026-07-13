# Payments — swap or add a provider

Payments live behind **one typed interface**, `PaymentProvider` in
[`services/payment/src/provider.ts`](../../services/payment/src/provider.ts). Apps and
services only ever call that interface (via `resolveProvider()`) — they never import a
vendor SDK. So switching Creem → Stripe/Paddle/Lemon Squeezy/Dodo, or running a second
provider, is a **one-file change** in `provider.ts`. Nothing in `apps/*` or the rest of
`services/*` moves. This is the `@stack/payment` adapter rule from
[`CLAUDE.md`](../../CLAUDE.md): _payments go through the adapter interface, never call a
vendor directly._

The ships-with proof: the repo carries **two** MoR adapters — `CreemProvider` (verified
REST contract) and `DodoProvider` ([Dodo Payments](https://dodopayments.com), a real MoR)
— behind the same interface. Dodo is the worked example below.

## The interface

```ts
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Returns the event if the signature is valid, else null. */
  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent | null;
}
```

Two methods: create a hosted checkout session, and verify + normalize an incoming
webhook. That's the whole contract an app depends on.

## Recipe — add or swap a provider (3 steps, one file + env)

### 1. Implement `PaymentProvider`

Add a class to `provider.ts`. Constructor takes the api key + webhook secret; implement
both methods. Model the shape on `CreemProvider` — a thin `fetch` client for the checkout
call and a timing-safe HMAC check for the webhook:

```ts
export class DodoProvider implements PaymentProvider {
  readonly name = "dodo";
  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string | undefined,
    baseUrl?: string,
  ) {
    /* pick sandbox vs live from the key prefix */
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // POST to the vendor's checkout endpoint → return { id, checkoutUrl }
  }

  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent | null {
    // HMAC-SHA256(rawBody, secret), timing-safe compare, then parseEvent(rawBody)
  }
}
```

> The shipped `DodoProvider` is a **typed starter skeleton**: real structure + correct
> types, a working HMAC `verifyWebhook`, and `TODO(dodo)` markers where the actual Dodo
> HTTP calls go (we don't pin Dodo's live REST contract the way Creem's is verified).
> It typechecks and satisfies the interface — fill the TODOs against
> <https://docs.dodopayments.com> and confirm the real signature scheme before going live.

Verify the webhook over the **raw request bytes** — `services/payment/src/index.ts` reads
`c.req.text()` before any JSON parse, because the signature is over exact bytes.

### 2. Register it in `resolveProvider`

One selection function decides who's live. Resolution order:

1. **Explicit selector** — `PAYMENT_PROVIDER=creem|dodo|mock` wins if set.
2. **Auto-detect by key** — otherwise, whichever `*_API_KEY` is present.
3. **Mock** — nothing configured → `MockProvider`, so the service always boots keyless.

```ts
if (selector === "dodo" || (!selector && env.DODO_API_KEY)) {
  return new DodoProvider(env.DODO_API_KEY, env.DODO_WEBHOOK_SECRET);
}
```

### 3. Add its env keys

Document them in `.env.example` next to the Creem keys:

```bash
# PAYMENT_PROVIDER=dodo          # or auto-detect by key
# DODO_API_KEY=
# DODO_WEBHOOK_SECRET=
```

That's it. No app touched — `apps/*` still just POST to `/checkout` and receive
`/webhook`; the adapter picked who fulfils it.

## Why this holds

The interface is the contract; vendors are implementations. As long as a provider can
create a checkout URL and verify a signed webhook, it drops in behind `resolveProvider`
and every consumer keeps working unchanged. That's the payoff of the adapter rule: your
call sites are never coupled to a payment vendor.

## Tests

`services/payment/src/provider.test.ts` (run with `bun test`) covers each provider's
`verifyWebhook` (accepts a correctly-signed body, rejects a tampered one) and asserts
`resolveProvider` picks the right provider per env. Add the same three assertions for any
new provider you wire in.
