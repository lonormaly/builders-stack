import { render } from "@react-email/render";
import { createElement } from "react";
import type { ComponentType } from "react";
import { Resend } from "resend";
import { EMAIL_FROM, RESEND_API_KEY } from "./env";
import { WelcomeEmail } from "./templates/welcome";
import type { WelcomeEmailProps } from "./templates/welcome";
import { VerifyEmail } from "./templates/verify-email";
import type { VerifyEmailProps } from "./templates/verify-email";
import { DripDay3 } from "./templates/drip-day3";
import type { DripDay3Props } from "./templates/drip-day3";

// Typed template registry: name -> the props that template requires.
// Add a template by extending this map + the two records below; call sites stay type-safe.
export interface TemplateProps {
  welcome: WelcomeEmailProps;
  "verify-email": VerifyEmailProps;
  "drip-day3": DripDay3Props;
}

const templates: { [K in keyof TemplateProps]: ComponentType<TemplateProps[K]> } = {
  welcome: WelcomeEmail,
  "verify-email": VerifyEmail,
  "drip-day3": DripDay3,
};

const subjects: { [K in keyof TemplateProps]: string } = {
  welcome: "Welcome to Builder's Stack",
  "verify-email": "Verify your email address",
  "drip-day3": "Getting the most out of Builder's Stack",
};

// ponytail: one lazily-created Resend client; only built when a key exists.
let resend: Resend | null = null;
function client(): Resend | null {
  if (!RESEND_API_KEY) return null;
  resend ??= new Resend(RESEND_API_KEY);
  return resend;
}

export interface SendEmailArgs<T extends keyof TemplateProps> {
  to: string;
  template: T;
  props: TemplateProps[T];
  /** Override the default subject for this template. */
  subject?: string;
}

/**
 * Render a React Email template to HTML + plain text and send it via Resend.
 * ENV-GATED: with no RESEND_API_KEY it logs and returns null (no throw), so the
 * app boots and local dev works without email set up.
 */
export async function sendEmail<T extends keyof TemplateProps>({
  to,
  template,
  props,
  subject,
}: SendEmailArgs<T>): Promise<{ id: string } | null> {
  const element = createElement(templates[template] as ComponentType<TemplateProps[T]>, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const api = client();
  if (!api) {
    console.warn(`[email] RESEND_API_KEY unset — skipped "${template}" email to ${to}`);
    return null;
  }

  const { data, error } = await api.emails.send({
    from: EMAIL_FROM,
    to,
    subject: subject ?? subjects[template],
    html,
    text,
  });
  if (error) throw new Error(`[email] Resend send failed: ${error.message}`);
  return data ? { id: data.id } : null;
}
