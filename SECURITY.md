# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Report it privately:

- open a [GitHub private security advisory](https://github.com/lonormaly/builders-stack/security/advisories/new) (Security → Advisories → _Report a vulnerability_). It's private to you and the maintainers until a fix ships.

Please give us a reasonable window to fix and release before any public disclosure. We'll acknowledge your report and keep you posted on the fix.

## Scope

This repo is a **starter template** — you clone it and build your product on top. Reports in scope:

- A vuln in the **stack itself**: the auth wiring (`libs/auth`), the payment webhook verification (`services/payment`), the env/secrets handling (`libs/config`, `.env.example`), the shipped MCP config (`agents/mcp.json`), or a default that is insecure out of the box.
- A dependency we pin that ships a known, exploitable vuln (see [Dependabot](.github/dependabot.yml) — it opens weekly PRs for these automatically).

**Out of scope:** vulnerabilities in _your_ product code after you fork, and issues that require a key/secret you deliberately committed (see below — don't).

## Security posture (what the template guarantees)

- **No secrets in the repo.** Real secrets live only in `.env.local`, which is git-ignored. `.env.example` documents every key with an empty value; a fresh clone boots on an empty file. As you grow, move the source of truth to [Infisical](docs/secrets.md) — no secret ever lands in a committed file.
- **Every paid integration is env-gated.** No key → silent no-op, the app still boots. Nothing phones home or spends money until you opt in with a key. AI, email, payments, and analytics are all off by default.
- **The shipped Postgres MCP is read-only.** `agents/mcp.json` runs `postgres-mcp --access-mode=restricted` — the agent can read your live schema/data but cannot write, and it replaces the archived, SQL-injectable `@modelcontextprotocol/server-postgres`.
- **Payment webhooks are signature-verified.** `services/payment` rejects any webhook whose HMAC signature doesn't match (`CreemProvider.verifyWebhook`), covered by a test.
- **Auth sessions are signed** with `BETTER_AUTH_SECRET` (generate your own; never reuse an example value).

## Supply chain — agent skills & MCPs

A skill or MCP you hand your agent is **executable code running with your agent's permissions, plus a payload the model obeys** — the same swap that replaced the SQL-injectable Postgres MCP with a read-only one applies to everything you add next. Before installing an unfamiliar skill/MCP, run the **"vet before you install" law** (scan → read the source → check permissions/hooks → check provenance → prefer first-party & pin a commit): [`docs/stack/agent-skills.md`](docs/stack/agent-skills.md), with the first-gate reputation check at [`scripts/scan-skill.sh`](scripts/scan-skill.sh). It also carries our curated, scan-gated recommended list so you don't vendor something untrusted.

If you find a gap in any of the above, that's exactly the kind of report we want.
