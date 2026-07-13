import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { APP_URL } from "../env";

export interface DripDay3Props {
  name: string;
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "-apple-system, Segoe UI, sans-serif" };
const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };
const button = {
  backgroundColor: "#111827",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "12px 20px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};

// Day-3 of the onboarding drip. This template is coded here; the *trigger* is a
// PostHog campaign configured in the UI off the `user_signed_up` event — see docs/stack/email.md.
export function DripDay3({ name }: DripDay3Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Three days in — here&apos;s what to try next</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading>Getting the most out of the stack</Heading>
          <Text>
            Hi {name}, a few days in — have you tried the dashboard, the design system, and the
            typed API yet? Here&apos;s where to go next.
          </Text>
          <Button href={APP_URL} style={button}>
            Jump back in
          </Button>
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: "13px" }}>
            Reply any time — a human reads these.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

DripDay3.PreviewProps = { name: "Ada" } satisfies DripDay3Props;

export default DripDay3;
