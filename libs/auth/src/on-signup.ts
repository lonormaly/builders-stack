import { PostHog } from "posthog-node";
import { sendEmail } from "@stack/email";
// Server-safe event catalog — same names/types the client's `track` uses. Import from
// the /events subpath (no browser SDK) so this server module stays import-safe.
import { serverEvent } from "@stack/analytics/events";

const KEY = process.env.POSTHOG_API_KEY;
const HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

// ponytail: dedicated server-side PostHog client for the signup hook. It mirrors
// services/api/src/analytics.ts (same 6 lines) because a lib can't import a
// service. Extract a @stack/analytics lib if a third consumer shows up.
let ph: PostHog | null | undefined;
function posthog(): PostHog | null {
  if (ph === undefined) ph = KEY ? new PostHog(KEY, { host: HOST }) : null;
  return ph;
}

/**
 * Runs after Better Auth creates a user (see `databaseHooks.user.create.after`).
 * This is the concrete event -> email seed for the PostHog-driven drip (docs/email.md):
 *   (a) capture a `user_signed_up` PostHog event — the drip campaign's trigger
 *   (b) send the coded welcome email (day-0) via @stack/email
 * ENV-GATED: no keys -> both calls no-op, sign-up still succeeds.
 */
export async function onUserSignedUp(user: {
  id: string;
  email: string;
  name?: string | null;
}): Promise<void> {
  const name = user.name?.trim() || user.email.split("@")[0] || "there";

  // (a) analytics event — server-side, attributed to the new user's id. The name +
  // payload are checked against the shared catalog (@stack/analytics/events).
  posthog()?.capture({
    distinctId: user.id,
    ...serverEvent("user_signed_up", { email: user.email }),
  });

  // (b) welcome email — never let a mail failure break sign-up
  try {
    await sendEmail({ to: user.email, template: "welcome", props: { name } });
  } catch (err) {
    console.error("[auth] welcome email failed", err);
  }
}
