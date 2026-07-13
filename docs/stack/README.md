# Stack docs — how the template works

These docs explain how the builders-stack **template** works and why its choices
were made. They are about the **template**, not about YOUR product — reference
material for understanding the shape you cloned, not something your app's users or
your git history need to carry.

When you make this repo yours, strip them from your git history (they stay on disk
as reference):

```sh
git rm -r --cached docs/stack && echo 'docs/stack/' >> .gitignore
```

The files remain on disk; they just stop being tracked in your fork. See
[`make-it-yours.md`](./make-it-yours.md#strip-the-templates-explainer-docs).

## The docs

- [`getting-started.md`](./getting-started.md) — fresh clone → running app: which key each integration wants, where to get it, what runs without it.
- [`architecture.md`](./architecture.md) — the `apps`/`services`/`libs`/`packages`/`ops` taxonomy and the two laws (no-upward-import, one-public-door), with diagrams.
- [`free-stack.md`](./free-stack.md) — one entry per tool: why it's here, what you get free, the honest caveat, where it's wired in this repo.
- [`costs.md`](./costs.md) — ~$0/month at MVP scale: each tool's free tier, its first paid trigger, and the next-tier price.
- [`make-it-yours.md`](./make-it-yours.md) — gut the worked-example packages, rename the `@stack/*` scope, strip what you don't need. The structure is the product.
- [`migration.md`](./migration.md) — bring an existing codebase into the taxonomy one role at a time, keeping the build green between moves.
- [`database.md`](./database.md) — why Neon/Postgres via Drizzle, what each alternative actually trades for, and when a swap is worth it.
- [`ai.md`](./ai.md) — `@stack/ai`: a provider-agnostic model client over the Vercel AI SDK; swap providers with a string. The one layer with no free tier.
- [`analytics.md`](./analytics.md) — PostHog + Microsoft Clarity: product analytics, session replay, and error tracking, client and server.
- [`email.md`](./email.md) — `@stack/email`: Resend + React Email with typed, previewable templates and a `sendEmail()` sender.
- [`payments.md`](./payments.md) — the `PaymentProvider` adapter interface: swap or add a provider (Creem/Dodo/…) as a one-file change.
- [`agent-skills.md`](./agent-skills.md) — the "vet before you install" law for agent skills/MCPs, plus a curated, scan-gated recommended list.
