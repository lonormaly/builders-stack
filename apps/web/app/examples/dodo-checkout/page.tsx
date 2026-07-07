import { pageMetadata } from "@stack/seo";
import BuyDemo from "./BuyDemo";

// Minimal demo page: server-rendered product card shell; the interactive Buy
// flow (fetch → CheckoutModal) lives in the BuyDemo client child.
export const metadata = pageMetadata({
  title: "White-label Checkout Example",
  description:
    "Demo of a white-label Dodo Payments checkout — a product card that opens the hosted checkout inside an on-domain modal.",
  path: "/examples/dodo-checkout",
});

export default function DodoCheckoutExamplePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 6,
          padding: 32,
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#171717" }}>Demo Product</h1>
        <p style={{ margin: "8px 0 24px", fontSize: 14, color: "#525252" }}>$10.00</p>
        <BuyDemo />
      </div>
    </main>
  );
}
