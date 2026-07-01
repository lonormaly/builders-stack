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

export interface WelcomeEmailProps {
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

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Builder&apos;s Stack — your account is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading>Welcome, {name} 👋</Heading>
          <Text>
            Thanks for signing up. Your account is ready — clone the structure, run one command, and
            start shipping.
          </Text>
          <Button href={APP_URL} style={button}>
            Open the app
          </Button>
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: "13px" }}>
            You&apos;re receiving this because you created a Builder&apos;s Stack account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmail.PreviewProps = { name: "Ada" } satisfies WelcomeEmailProps;

export default WelcomeEmail;
