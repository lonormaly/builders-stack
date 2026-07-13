// @stack/payment — Creem checkout + webhooks (Hono).
//   GET  /health     liveness + which provider is live
//   POST /checkout   create a checkout session
//   POST /webhook    verify signature, handle subscription/payment events
// Boots without CREEM_API_KEY (falls back to Mock); goes live when the key is set.
import { Hono } from "hono";
import { z } from "zod";
import { resolveProvider, type WebhookEvent } from "./provider.js";
import { reportError } from "@stack/observability";

const provider = resolveProvider();
const app = new Hono();

// Reject oversized bodies before parsing (cheap DoS guard) + baseline security headers.
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
app.use("*", async (c, next) => {
  if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
});

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "payment",
    provider: provider.name,
    live: provider.name === "creem",
  }),
);

const CheckoutBody = z.object({
  productId: z.string().min(1),
  requestId: z.string().optional(),
  successUrl: z.string().url().optional(),
  customerEmail: z.string().email().optional(),
});

app.post("/checkout", async (c) => {
  const parsed = CheckoutBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body", issues: parsed.error.issues }, 400);
  try {
    const session = await provider.createCheckout(parsed.data);
    return c.json(session, 201);
  } catch (err) {
    reportError(err, { service: "payment", route: "checkout" });
    return c.json({ error: "Checkout failed" }, 502);
  }
});

// Webhook: read the RAW body BEFORE parsing — the signature is over exact bytes.
app.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("creem-signature") ?? null;
  const event = provider.verifyWebhook(rawBody, signature);
  if (!event) return c.json({ error: "Invalid signature" }, 401);
  handleEvent(event);
  return c.json({ received: true });
});

function handleEvent(event: WebhookEvent): void {
  switch (event.eventType) {
    case "checkout.completed":
      console.log("[payment] checkout completed", event.object.id ?? "");
      break;
    case "subscription.active":
    case "subscription.paid":
      console.log("[payment] subscription active/paid", event.object.id ?? "");
      // grant/extend entitlement here
      break;
    case "subscription.canceled":
    case "subscription.expired":
      console.log("[payment] subscription ended", event.object.id ?? "");
      // revoke entitlement here
      break;
    case "refund.created":
    case "dispute.created":
      console.log(`[payment] ${event.eventType}`, event.object.id ?? "");
      break;
    default:
      console.log("[payment] unhandled event", event.eventType);
  }
}

// PORT is injected by portless in local dev (payment.stack.localhost:1355);
// falls back to 3002 for standalone `bun --filter @stack/payment dev`.
const port = Number(process.env.PORT) || 3002;
console.log(`[payment] listening on http://localhost:${port}  (provider: ${provider.name})`);

export default { port, fetch: app.fetch };
