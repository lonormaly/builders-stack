import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

export interface VerifyEmailProps {
  name: string;
  verifyUrl: string;
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

export function VerifyEmail({ name, verifyUrl }: VerifyEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your email address</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading>Verify your email</Heading>
          <Text>Hi {name}, confirm your email address to finish setting up your account.</Text>
          <Button href={verifyUrl} style={button}>
            Verify email
          </Button>
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: "13px" }}>
            If the button doesn&apos;t work, copy this link:{" "}
            <Link href={verifyUrl}>{verifyUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

VerifyEmail.PreviewProps = {
  name: "Ada",
  verifyUrl: "https://example.com/verify?token=preview",
} satisfies VerifyEmailProps;

export default VerifyEmail;
