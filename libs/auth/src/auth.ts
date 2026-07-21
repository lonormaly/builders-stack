import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@stack/db";
import { sendEmail } from "@stack/email";
import { onUserSignedUp, logSignIn } from "./on-signup";

// ENV-GATED: importing this module must never throw when secrets are absent.
// Every env read falls back to "" so `auth` constructs cleanly at import time;
// the real values only matter when a request actually hits the auth handler.
// ponytail: real BETTER_AUTH_SECRET + GitHub OAuth creds are required at RUNTIME —
// empty fallbacks let typecheck/build/import pass, not production.
export const auth = betterAuth({
  // Wired to the real Drizzle tables in @stack/db so sign-up / sign-in persist
  // to Postgres. Keys match Better Auth's model names; regenerate the tables with
  // `bun run auth:generate` if you add plugins (2FA, passkey, …).
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),

  secret: process.env.BETTER_AUTH_SECRET ?? "",
  baseURL: process.env.BETTER_AUTH_URL ?? "",

  // Origins allowed to send credentialed auth requests (the web app). Comma-separated.
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3000").split(","),

  emailAndPassword: {
    enabled: true,
    // Enforce only when mail can actually be delivered: with no RESEND_API_KEY every
    // send is a logged no-op (see @stack/email), so requiring verification keyless
    // would lock every new account out of sign-in. Keyed (staging/prod) ⇒ enforced;
    // keyless local dev ⇒ sign-up works as before.
    requireEmailVerification: Boolean(process.env.RESEND_API_KEY),
  },

  // Verification mail goes out through the same env-gated @stack/email door as the
  // welcome mail (typed "verify-email" template). Better Auth generates + stores the
  // token in the `verification` table and builds the callback `url` itself.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: verifyUser, url }) => {
      const name = verifyUser.name?.trim() || verifyUser.email.split("@")[0] || "there";
      try {
        await sendEmail({
          to: verifyUser.email,
          template: "verify-email",
          props: { name, verifyUrl: url },
        });
      } catch (err) {
        // Never let a mail failure break the sign-up flow; the user can re-request.
        console.error("[auth] verification email failed", err);
      }
    },
  },

  // Session cookie-cache — ON by default. `getSession` runs on nearly every request;
  // without this it's a Postgres round-trip each time, which pins Neon compute awake and
  // burns the free tier's CU-hours (the dominant drain, learned the hard way in prod).
  // The session is cached in a signed, short-TTL cookie and trusted without a DB read
  // until it expires; the DB is touched only on cache miss. TTL = 5 min, so server-side
  // revocation (logout-everywhere, ban) lags at most that window — do sensitive checks
  // (entitlements/roles) against the DB directly, not off the cached session.
  // Don't extend the TTL to "save more DB": it's a revocation dial, not a cost dial, and an
  // idle client makes zero requests anyway (compute suspends regardless). To take session
  // reads off Postgres entirely, add Better Auth `secondaryStorage` (Cloudflare Workers KV
  // / DO) — see agents/skills/run-lean-on-neon.
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // seconds
    },
  },

  // Better Auth's current hook API. `user.create.after` fires once a user row is
  // persisted (email/password OR social) — the single choke point where every
  // sign-up routes through, so the drip seed lives here, not per-provider.
  // `session.create.after` fires on every successful sign-in — the audit choke point.
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await onUserSignedUp(createdUser);
        },
      },
    },
    session: {
      create: {
        after: async (createdSession) => {
          // SOC2 audit trail: one securityEvent() per successful sign-in (structured
          // stdout line + optional PostHog). Sign-out / failed-login are ready to wire
          // the same way — see docs/soc2-readiness.md.
          logSignIn(createdSession.userId);
        },
      },
    },
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
});
