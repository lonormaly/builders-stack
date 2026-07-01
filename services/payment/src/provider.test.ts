// Money/security path → gets a runnable check. `bun test`
import { expect, test } from "bun:test";
import * as crypto from "node:crypto";
import { CreemProvider, MockProvider, resolveProvider } from "./provider.js";

test("MockProvider creates a checkout url carrying the product", async () => {
  const p = new MockProvider();
  const session = await p.createCheckout({ productId: "prod_1", successUrl: "https://x.test/ok" });
  expect(session.id).toStartWith("mock_");
  expect(session.checkoutUrl).toContain("product=prod_1");
});

test("resolveProvider is env-gated: Mock without key, Creem with key", () => {
  expect(resolveProvider({} as NodeJS.ProcessEnv).name).toBe("mock");
  expect(resolveProvider({ CREEM_API_KEY: "creem_test_x" } as NodeJS.ProcessEnv).name).toBe(
    "creem",
  );
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
