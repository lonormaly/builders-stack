// POST /api/examples/dodo-checkout — creates a Dodo test checkout session for
// the demo product and returns { url } for the inline CheckoutModal to embed.
import {
  createCheckoutSession,
  ensureDemoProduct,
} from "../../../examples/dodo-checkout/server-create-checkout";

export async function POST() {
  const productId = await ensureDemoProduct();
  const { url } = await createCheckoutSession({
    productId,
    customerEmail: "demo@example.com",
    customerName: "Demo Customer",
    metadata: { example: "dodo-whitelabel-checkout" },
  });
  return Response.json({ url });
}
