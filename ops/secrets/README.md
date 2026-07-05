# `ops/secrets/` — provision env & secrets with **Ringtail**

This folder does exactly one thing: point you at **[Ringtail](https://github.com/ringtailkeys/ringtail)**.
There is deliberately **no secret store, vault, or `.env` generator here** — Ringtail owns that
model end to end, and duplicating it would only drift.

## What Ringtail is

> 🦝 _The OSS raccoon that raids the token pages so you don't._

A **local, open-source, agent-orchestrated credential-provisioning tool**. Your coding agent
reads this repo's **`.env.example` as the manifest** — the shopping list of every key the stack
needs — and Ringtail raids each provider's token page via their **official APIs**, scope-validates
every key, and fans it out into:

- **`.env.local`** for local dev, and
- **[Infisical](../../docs/secrets.md)** for `dev` / `staging` / `prod`.

**One human "allow" per provider, then zero-touch forever.** This maps 1:1 onto how the stack
already handles secrets (see [`docs/secrets.md`](../../docs/secrets.md)): local = `.env.local`,
team/prod = Infisical.

## Run it

```bash
npx ringtail          # === `ringtail up` — boots the local daemon + cockpit
# or, from this repo:
ops/secrets/bootstrap.sh
```

`npx ringtail` boots a local **daemon** and opens the **cockpit** (a providers × environments
grid). It detects your coding agent (`claude`, `codex`, `cursor`, `gemini`) on your PATH and hands
you the exact command to register the daemon as an MCP server. The agent then plans and runs the
raid — **mint → validate → provision → sync** — cells flipping green as it goes. Nothing installs
globally; nothing phones home.

## 🔒 The guarantee — the agent never sees a value

This is the spine of Ringtail, and it's an **enforced, verifiable invariant**, not a promise. A
pasted key flows **you → the daemon → its store**, and never crosses the agent's MCP boundary —
there is _no MCP tool that returns a secret value_. The daemon makes the provider API calls with
the stored creds and returns **status, not values**. Keys live in `~/.ringtail` (`0600`); zero
telemetry. A leak-guard (`bun run check:no-leak`) runs in Ringtail's CI and fails the build if any
daemon → agent message ever carries a value.

## What does NOT belong here

- No app secrets committed to the repo (that's what `.env.local` + Infisical are for).
- No home-grown vault / rotation daemon — if you'd be reinventing Ringtail, use Ringtail.
- Rotating a specific key operationally? See [`../runbooks/rotate-a-key.md`](../runbooks/rotate-a-key.md).
