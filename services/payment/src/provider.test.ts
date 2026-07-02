// Money/security path → gets a runnable check. `bun test`
import { expect, test } from "bun:test";
import * as crypto from "node:crypto";
import {
  CreemProvider,
  DodoProvider,
  MockProvider,
  type PaymentProvider,
  resolveProvider,
} from "./provider.js";

test("MockProvider creates a checkout url carrying the product", async () => {
  const p = new MockProvider();
  const session = await p.createCheckout({ productId: "prod_1", successUrl: "https://x.test/ok" });
  expect(session.id).toStartWith("mock_");
  expect(session.checkoutUrl).toContain("product=prod_1");
});

test("DodoProvider satisfies the interface and creates a checkout-shaped result", () => {
  const p: PaymentProvider = new DodoProvider("dodo_test_x", "whsec_dodo");
  expect(p.name).toBe("dodo");
  expect(typeof p.createCheckout).toBe("function");
  expect(typeof p.verifyWebhook).toBe("function");
});

test("resolveProvider is multi-vendor + env-gated", () => {
  // nothing configured → Mock (boots keyless)
  expect(resolveProvider({} as NodeJS.ProcessEnv).name).toBe("mock");
  // auto-detect by key presence
  expect(resolveProvider({ CREEM_API_KEY: "creem_test_x" } as NodeJS.ProcessEnv).name).toBe(
    "creem",
  );
  expect(resolveProvider({ DODO_API_KEY: "dodo_test_x" } as NodeJS.ProcessEnv).name).toBe("dodo");
  // explicit selector wins
  expect(
    resolveProvider({ PAYMENT_PROVIDER: "dodo", DODO_API_KEY: "dodo_test_x" } as NodeJS.ProcessEnv)
      .name,
  ).toBe("dodo");
  expect(
    resolveProvider({ PAYMENT_PROVIDER: "mock", CREEM_API_KEY: "x" } as NodeJS.ProcessEnv).name,
  ).toBe("mock");
});

test("DodoProvider.verifyWebhook accepts a correctly signed body, rejects tampered", () => {
  const secret = "whsec_dodo";
  const p = new DodoProvider("dodo_test_x", secret);
  const body = JSON.stringify({
    id: "evt_1",
    eventType: "subscription.paid",
    object: { id: "sub_1" },
  });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const ok = p.verifyWebhook(body, sig);
  expect(ok?.eventType).toBe("subscription.paid");
  expect(ok?.object.id).toBe("sub_1");

  expect(p.verifyWebhook(body, "deadbeef")).toBeNull();
  expect(p.verifyWebhook(body + " ", sig)).toBeNull(); // body tampered
  expect(p.verifyWebhook(body, null)).toBeNull(); // missing signature
});

test("CreemProvider.verifyWebhook accepts a correctly signed body, rejects tampered", () => {
  const secret = "whsec_test";
  const p = new CreemProvider("creem_test_x", secret);
  const body = JSON.stringify({
    id: "evt_1",
    eventType: "subscription.paid",
    object: { id: "sub_1" },
  });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const ok = p.verifyWebhook(body, sig);
  expect(ok?.eventType).toBe("subscription.paid");
  expect(ok?.object.id).toBe("sub_1");

  expect(p.verifyWebhook(body, "deadbeef")).toBeNull();
  expect(p.verifyWebhook(body + " ", sig)).toBeNull(); // body tampered
  expect(p.verifyWebhook(body, null)).toBeNull(); // missing signature
});
