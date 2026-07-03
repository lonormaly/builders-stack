# @builders-stack/provision — keys in, cloud out

A fresh builders-stack clone [boots on an empty `.env.local`](../../docs/getting-started.md):
every paid integration is env-gated to a silent no-op. This CLI is how you turn the
features on — it reads `.env.example` as the manifest of what the repo _understands_,
figures out which providers you need, walks you through getting each key, **validates
it against the real API before it lets you move on**, and writes `.env.local` for you.

```bash
npx @builders-stack/provision      # or: bsp
```

No more pasting a Cloudflare token, deploying, and finding out an hour later you
forgot the `Workers Scripts:Edit` scope. The paste is checked on the spot.

---

## The root-cred store — `~/.builders-stack` (like `~/.aws`)

Your Cloudflare token, your Neon key — those are the **same no matter which repo**
you're setting up. So they live **once**, in `~/.builders-stack/credentials.json`
(`0600`, keyed by provider), and every `bsp` run in every repo reuses them.

When a provider's root cred is already on disk, `bsp` doesn't re-prompt — it
**re-validates** the stored key against the live API and shows you:

```
◇  Found Cloudflare in ~/.builders-stack — re-validating…
│  ✓ Cloudflare — token active, account 1a2b3c
```

Only **per-repo** values (a project-scoped account id, a generated auth secret) land
in that repo's `.env.local`. Nothing repo-specific pollutes the shared store; nothing
shared gets copied into a repo you might commit by accident. Override the location
with `BUILDERS_STACK_HOME`.

---

## Validate-on-paste — the actual point

Every guided provider ships a **real API probe**. You paste the key, `bsp` calls the
provider, and reports exactly what the token can and can't do — in color:

```
◆  Cloudflare — scope report
│  token authenticated, account 1a2b3c
│    ✓ Cloudflare Pages:Edit
│    ✓ Workers Scripts:Edit
│    ✗ MISSING  Zone DNS:Edit
│
◇  Cloudflare didn't validate. What now?
│  ● Retry — re-paste the credential
│  ○ Open the token page (https://dash.cloudflare.com/profile/api-tokens)
│  ○ Skip this provider
```

Green ✓ for what you granted, red ✗ for what's missing, then a loop: fix the token,
re-paste, done. A validated key gets stored; a broken one never makes it to disk.

---

## Two modes

### Interactive (`bsp`)

The default. A guided walk through every provider the repo needs:

1. **`intro`** banner + a one-line read of the manifest.
2. Per provider — reuse-and-revalidate from `~/.builders-stack`, or a `note()` with the
   deep-link + exact scopes, a masked paste prompt, the scope report, and the retry loop.
3. `generate`-mode providers (Better Auth's secret) are **minted locally** — no prompt.
4. A summary table (service · status · where it's stored) and the list of manifest vars
   **no provider covers** — the handful you still set by hand.

### Auto-provision (`bsp --provision`)

For `auto` providers (Neon, and DNS-capable registrars), don't just validate the key —
**use it**. `--provision` calls the provider's management API to create the resource
(a Neon project + database, a nameserver swap) and folds the resulting values (a fresh
`DATABASE_URL`) straight into `.env.local`, streaming progress on a spinner.

### Agent mode (`bsp --json`)

The non-interactive path — **no prompts, ever**. Creds come from `~/.builders-stack`,
the process env, and `--set KEY=VALUE` flags. It validates what's present and emits one
structured JSON object: the plan, per-provider status, and — critically — a `nextActions`
array of what a **human** still has to click, with the deep-links and required scopes.

```bash
bsp --json | jq '.nextActions'
```

```json
[
  {
    "service": "Cloudflare",
    "why": "missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID",
    "open": "https://dash.cloudflare.com/profile/api-tokens",
    "scopes": ["Account>Cloudflare Pages:Edit", "Account>Workers Scripts:Edit", "..."]
  }
]
```

This is how a **coding agent guides you**: it runs `bsp --json`, reads `nextActions`,
and tells you exactly which page to open and which boxes to tick. When you've pasted a
key, the agent re-runs and watches `ready` flip to `true`. Feed a key straight in with
`--set RESEND_API_KEY=re_…` (or export it) and the same run validates it.

---

## Providers

| Provider | Mode | Fills |
|---|---|---|
| **Neon** | `auto` | `DATABASE_URL` (creates the project/db with `--provision`) |
| **Cloudflare** | `guided` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| **Creem** | `guided` | `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET` |
| **GoDaddy** | `guided` | `GODADDY_API_KEY`, `GODADDY_API_SECRET` (registrar / DNS) |
| **Infisical** | `guided` | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` |
| **PostHog** | `guided` | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| **Resend** | `guided` | `RESEND_API_KEY` |
| **Better Auth** | `generate` | `BETTER_AUTH_SECRET` (minted locally) |

A provider only runs when the repo's `.env.example` actually names one of its vars — so
GoDaddy stays quiet for a repo with no `GODADDY_*` var, and shows up for one that has it.
Vars no provider owns (`AI_API_KEY`, the app URLs, `EMAIL_FROM`…) are listed at the end
as "set these by hand" — the CLI never guesses at them.

---

## How it fits builders-stack

`packages/` is **what you ship** — terminal artifacts (SDKs, the embeddable widget, this
CLI), tagged `type:package`, depending on `libs/*` only, imported by nothing inside the
repo. `provision` is the CLI face of that bucket: it doesn't run _in_ the stack, it's the
tool you run _to stand a stack up_. Adding a new integration to the monorepo? Drop a var
in `.env.example`, add a `Recipe` in [`src/recipes/`](./src/recipes) — one file, one
`validate()` probe — register it in [`src/recipes/index.ts`](./src/recipes/index.ts), and
it joins the walk. The CLI itself never changes.

---

## Adding a provider

One file in `src/recipes/<id>.ts` exporting a `recipe: Recipe` (the contract is frozen in
[`src/recipe.ts`](./src/recipe.ts)):

```ts
export const recipe: Recipe = {
  id: "acme",
  title: "Acme",
  mode: "guided",
  envVars: ["ACME_API_KEY"],
  rootCredKeys: ["ACME_API_KEY"],     // reused across repos
  tokenCreateUrl: "https://acme.dev/keys",
  requiredScopes: ["read", "write"],
  async validate(creds) {
    const res = await fetch("https://api.acme.dev/whoami", {
      headers: { authorization: `Bearer ${creds.ACME_API_KEY}` },
    });
    return res.ok
      ? { ok: true, detail: "authenticated", scopes: ["read", "write"] }
      : { ok: false, detail: `HTTP ${res.status}`, missing: ["read"] };
  },
};
```

Then add two lines to `src/recipes/index.ts` (import + push, in mode order). That's the
whole extension surface.

## Build & test

```bash
bun --filter @builders-stack/provision build      # esbuild → dist/cli.js (with shebang)
bun --filter @builders-stack/provision typecheck  # tsc --noEmit
bun test packages/provision                        # env-file upsert + cred-store gating
```

> **Example, not actually published.** `package.json` is `private: true`; its
> `publishConfig` / `bin` / `files` show the _shape_ a real published CLI takes —
> `npx @builders-stack/provision` and the `bsp` alias are what a real publish exposes.
