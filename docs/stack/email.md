# Email — Resend + React Email (`@stack/email`)

Transactional email with typed, previewable templates. Templates are authored as
React components (React Email); `sendEmail()` renders them to HTML + plain text and
sends via Resend.

- **Package:** `libs/email` (`@stack/email`), `type:lib`
- **Env:** `RESEND_API_KEY`, `EMAIL_FROM` (see `.env.example`)
- **Env-gated:** with no `RESEND_API_KEY`, `sendEmail()` logs a warning and returns
  `null` — it never throws, so the app boots and local dev works without email set up.

## Templates

React Email components in `libs/email/src/templates/`:

| Name (registry key) | File               | Props                 |
| ------------------- | ------------------ | --------------------- |
| `welcome`           | `welcome.tsx`      | `{ name }`            |
| `verify-email`      | `verify-email.tsx` | `{ name, verifyUrl }` |
| `drip-day3`         | `drip-day3.tsx`    | `{ name }`            |

Preview them live in a browser:

```bash
bun --filter @stack/email dev      # react-email preview server (email dev)
```

## Sending

`sendEmail` is the single public door — a **typed template registry**, so the
`props` you must pass are inferred from the `template` name:

```ts
import { sendEmail } from "@stack/email";

await sendEmail({ to: "user@example.com", template: "welcome", props: { name: "Ada" } });
// ^ TS error if you pass the wrong props for the chosen template.
```

Add a template: create `src/templates/<name>.tsx`, then add it to `templates` and
`subjects` in `src/send.ts` and to the `TemplateProps` map. Call sites stay type-safe.

## The drip workflow (event → PostHog → Resend)

The onboarding drip is **event-driven**, not a cron in this repo:

1. **Day 0 — coded, in this repo.** On sign-up, Better Auth's
   `databaseHooks.user.create.after` (in `libs/auth/src/auth.ts` →
   `src/on-signup.ts`) fires two things:
   - a PostHog `user_signed_up` event (`posthog-node`), and
   - the **welcome email** via `sendEmail({ template: "welcome", … })`.

   This `user_signed_up` event is the seed the rest of the drip hangs off.

2. **Day 3+ — configured in the PostHog UI.** The `drip-day3` template is coded
   here, but its _trigger_ lives in PostHog so you can tune timing/audience without
   a deploy. Two ways to wire it:

   **A. PostHog Messaging campaign (recommended)**
   1. PostHog → **Messaging → Campaigns → New campaign**.
   2. **Trigger:** event `user_signed_up`.
   3. Add a **Delay** step of `3 days`.
   4. (Optional) **Conditions** to exit early, e.g. skip if the user already
      converted/activated.
   5. **Action:** send email. Point it at your Resend template, or use PostHog's
      email step. To render the exact `drip-day3` component, expose a small
      `/internal/send-drip` route (or a workflow **HTTP/Hog** destination) that
      calls `sendEmail({ template: "drip-day3", props: { name } })`.

   **B. Hog function / CDP destination**
   PostHog → **Data pipeline → Destinations → New** → trigger on `user_signed_up`,
   add a 3-day delay, and POST to your send endpoint (or Resend directly).

Because the day-3 template is code and the schedule is config, you edit copy in the
repo and timing/targeting in PostHog — no redeploy to retune the campaign.
