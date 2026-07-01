// Single public door for @stack/email.
export { sendEmail } from "./send";
export type { SendEmailArgs, TemplateProps } from "./send";

// Templates are exported for reuse (e.g. Better Auth's own email callbacks).
export { WelcomeEmail } from "./templates/welcome";
export type { WelcomeEmailProps } from "./templates/welcome";
export { VerifyEmail } from "./templates/verify-email";
export type { VerifyEmailProps } from "./templates/verify-email";
export { DripDay3 } from "./templates/drip-day3";
export type { DripDay3Props } from "./templates/drip-day3";
