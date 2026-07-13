// Single source of truth for @stack/email config. Every value has a local-dev
// default so importing the package never throws; real values matter at send time.
// ponytail: plain env reads — no zod/config lib for four strings.

// From address for all transactional mail. Resend's shared test sender works
// out of the box; swap for a verified domain sender in prod (see docs/stack/email.md).
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

// CTA/base URL used inside templates. Matches the repo's WEB_ORIGIN convention.
export const APP_URL = process.env.WEB_ORIGIN ?? "http://web.stack.localhost:1355";

// Unset -> sendEmail() logs and no-ops (the app still boots without a key).
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
