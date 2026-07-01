# @stack/payment

Creem (Merchant of Record) checkout + webhooks, on Hono. **Env-gated**: boots on the
`MockProvider` with no credentials, switches to the real `CreemProvider` when
`CREEM_API_KEY` is set.

```bash
bun --filter @stack/payment dev      # http://localhost:3002  (port: PAYMENT_PORT, default 3002)
bun --filter @stack/payment test     # provider + webhook-signature tests
```

## Routes

| Method | Path        | Notes                                                                            |
| ------ | ----------- | -------------------------------------------------------------------------------- |
| GET    | `/health`   | Liveness + which provider is live                                                |
| POST   | `/checkout` | `{ productId, requestId?, successUrl?, customerEmail? }` → `{ id, checkoutUrl }` |
| POST   | `/webhook`  | Verifies `creem-signature`, handles subscription/payment events                  |

## Architecture

`provider.ts` — a typed `PaymentProvider` interface with two implementations:

- **`CreemProvider`** — real Creem REST client (verified against docs.creem.io):
  - `POST {base}/v1/checkouts` with header `x-api-key`, body `{ product_id, request_id, success_url }` → `{ id, checkout_url }`.
  - Base URL is chosen from the key prefix: `creem_test_` → `https://test-api.creem.io`, else `https://api.creem.io`.
  - Webhook verify: `creem-signature` header = hex `HMAC-SHA256(rawBody, CREEM_WEBHOOK_SECRET)`, compared with `crypto.timingSafeEqual`.
- **`MockProvider`** — no network, no signature check; for local dev and tests.

`resolveProvider()` does the env-gated selection.

## Env

```
CREEM_API_KEY=          # creem_test_… (sandbox) or creem_… (prod). Unset → Mock.
CREEM_WEBHOOK_SECRET=   # required to verify live webhooks
PAYMENT_PORT=3002
```

## Notes / unverified

- Implemented against Creem's **verified REST contract**, not the `creem` npm SDK —
  the SDK (`creem.checkouts.create(...)`) can drop in behind `PaymentProvider` unchanged
  if you want its typed models. REST is used here to avoid depending on SDK method
  signatures that weren't verifiable at build time.
- The exact JSON field for the event name (`eventType`) and the response `checkout_url`
  key are per Creem docs; `parseEvent` falls back to `type` defensively. Confirm field
  casing against your Creem dashboard's webhook samples before going live.
