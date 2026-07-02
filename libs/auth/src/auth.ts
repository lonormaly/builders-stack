import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@stack/db";
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
