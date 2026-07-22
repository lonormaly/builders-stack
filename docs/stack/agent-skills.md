# Agent skills — vet before you install

Agent skills (Claude Code skills, Cursor rules, MCP servers, hook bundles) are **executable code you hand your agent, running with your agent's permissions**. A skill can read your repo, run shell, and phone home. The same supply-chain caution you'd apply to an npm dependency applies here — more so, because a skill's payload is prose the model _obeys_, so a malicious one doesn't need an exploit, just a convincing instruction.

This repo's posture: **reinvent nothing worth reusing, vendor nothing untrusted, gate everything.** We already swapped the archived, SQL-injectable `@modelcontextprotocol/server-postgres` for a read-only `postgres-mcp --access-mode=restricted` (see [`SECURITY.md`](../../SECURITY.md)) — that's the bar. Third-party skills clear it or they don't get baked into the template.

Snyk's **"ToxicSkills"** research found prompt-injection in a large share of the skills they tested. **"Read the source" is not optional.**

---

## (a) The law — vet before you install (5 steps)

This is the meta-skill. Run all five before an unfamiliar skill touches your agent.

1. **Scan.** `./scripts/scan-skill.sh <name>` — queries [Clawdex](https://clawdex.koi.security) for a verdict.
   - `malicious` → **stop.** Don't install, don't "just read it to be sure."
   - `benign` → a green light on reputation only; keep going.
   - `unknown` → most raw GitHub repos are simply unindexed. **Not a pass and not a fail** — fall back to manual review + a code scanner (semgrep/Snyk) over the bundled scripts. Don't rely on the scanner alone; it catches known patterns, not a novel prompt injection.

2. **Read the source — the actual `SKILL.md` AND every bundled script/hook, not the README.** The README is marketing; the payload is the instructions and the scripts. **Reject on sight:**
   - prompt-injection / override language ("ignore previous instructions", "you are now…", "do not tell the user")
   - data sent to any non-official URL (exfiltration)
   - hidden / obfuscated / base64-encoded instructions
   - "act without confirmation" / "auto-approve" language
   - a `curl … | sh` (or `| bash`) install step — piping a remote script straight into a shell is the classic supply-chain vector.

3. **Check permissions.** Inspect the `allowed-tools` frontmatter and **any hooks**. Hooks auto-execute — they run without the agent (or you) choosing to, which makes them the **highest-risk** surface. Reject broad tool grants and reject anything that installs an auto-firing hook you didn't ask for.

4. **Check provenance.** Official (`anthropics/*`) or an established author/firm beats a single-author, brand-new, low-signal repo. Treat **mega-aggregator installer CLIs** (tools that bulk-install thousands of skills) as **untrusted by default** — that's the exact threat model, an unauditable pile you can't read. Confirm a real `LICENSE` exists.

5. **Prefer first-party; pin commits.** If the skill is small, **author it yourself** — a fifty-line skill you wrote beats a vendored dependency you have to keep re-vetting. When you _do_ vendor, **pin a commit SHA, never a moving branch** — a branch can be rewritten under you after you reviewed it.

> One line to remember: **a skill is code with your permissions and a payload the model obeys. Read it like you'd read a dependency you're about to `sudo`.**

---

## (b) The curated, scan-gated recommended list

From our own security vetting. Three tiers. **Scan every one before install** (`./scripts/scan-skill.sh <name>`) — a recommendation here is a starting point, not a substitute for the 5-step law above. Verdicts and repos drift; re-check at install time.

### Tier 1 — Adapt / recommend (clean, low-footprint, reputable)

Safe to draw from for a public starter. Cherry-pick; don't bulk-import.

| Skill                                                  | Why                                                                                        | Note                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **`anthropics/*`** (official)                          | First-party, maintained, lowest supply-chain risk. **Start here for anything they cover.** | —                                                                                                 |
| **`coreyhaines31/marketingskills`**                    | MIT, clean, well-scoped. Marketing/GTM is the developer weak spot — this fills it.         | **Cherry-pick a few** (cold-email, CRO, **`ai-seo`** — vendored, see below) — don't dump all ~50. |
| **`mattpocock/skills`**                                | Testing + TypeScript, from a reputable author.                                             | —                                                                                                 |
| **`trailofbits/skills`**                               | Security review / code-audit — **the gold standard**.                                      | **CC-BY-SA** — preserve attribution if you redistribute.                                          |
| **`ui-ux-pro-max`** — data-CSV knowledge base **only** | The CSV knowledge base is inert data, low-risk, useful.                                    | Take **only** the data-CSV part; the full bundle is Tier 2.                                       |

### Tier 2 — Link-only / scan-first / opt-in (great but heavy or hook-installing)

Genuinely good, but **install them yourself — don't bake them into the template.** Weight or auto-executing behavior makes them a per-user choice, not a default.

| Skill                       | Why link-only                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pbakaus/impeccable`**    | Excellent design skill — but **~124 MB**, **auto-firing post-edit hooks**, and a **daily phone-home version check**. All fine if _you_ opt in; wrong to impose on every cloner. |
| **the full `ui-ux` bundle** | Heavy; only the data-CSV slice (Tier 1) is lightweight enough to recommend outright.                                                                                            |
| **Snyk Fix**                | Strong, but needs the **Snyk MCP** wired up — an external dependency, so it's opt-in per user.                                                                                  |

### Tier 3 — Reject for a public starter

Do not ship these in a template. Not a judgment on every use — a judgment on _shipping them to strangers by default_.

- **Offensive-security payload bundles** — web shells, SecLists, exploit kits. No place in a starter.
- **Mega-aggregator installer CLIs** — thousands of unauditable skills behind one install command. This is the exact threat model the law exists to stop.
- **Single-author "meta-harness" mega-repos** (e.g. ECC) — too much surface, one owner, low signal. Too much to vet, too much to trust.

---

## (c) Don't hand the agent your prod keys — broker them

The law above governs **what code the agent runs**. This is the other half: **what secrets it holds.** The reason we scan skills is that anything the agent runs inherits the agent's access — so the strongest form of that principle is to make sure the agent's access includes **no real credentials at all.**

**Climb this as the keys get worth stealing — don't front-load it.**

- **MVP / local (what this repo ships).** MCP configs use `${VAR}` refs resolved from `.env.local` (git-ignored); nothing secret is committed, the keys are free-tier, and they live on your laptop. Proportionate — don't over-build.
- **Team / prod.** When the agent handles _real_ prod credentials (paid APIs, prod DB, CI runners), stop putting them in the agent's env. Broker them: a **credential broker / transparent proxy** — [Infisical Agent Proxy](https://infisical.com/docs/documentation/platform/agent-proxy/quickstart) is the worked example — leaves the agent holding only placeholders (`HTTPS_PROXY=broker:port`) while the broker injects the real secret on the wire. A prompt-injected skill then has nothing in its env to exfiltrate.

**Read the mechanism honestly before adopting it — it's a MITM proxy, which is a real trade, not a free lunch:**

- To inject a credential into **outbound HTTPS**, the broker **terminates TLS**: it decrypts the agent's traffic, adds the secret, re-encrypts to the upstream. The agent must **trust the broker's root CA**. So you didn't _delete_ the secret — you **moved** it into a proxy that can now read _all_ the agent's HTTPS in cleartext. That's a concentration of trust, which is exactly why it belongs on **separate infra inside a private network**, with a split identity (a _proxy_ identity that may read secrets, an _agent_ identity that may only proxy). Run the broker on the same laptop as the agent and there's no trust boundary — you've added a component, not isolation.
- **Coverage is HTTP-only.** It brokers requests that flow through the proxy — the HTTP MCP servers (`neon`, `posthog`), app→API calls. It does **not** cover the **Postgres wire** (`DATABASE_URL` / `postgres-mcp` — not HTTP, no header to rewrite) or **stdio servers keyed by a process env var** (`context7`, `filesystem`). Anything that cert-pins or ignores `HTTPS_PROXY` slips past. So it's "HTTP API creds are brokered," **not** "keys are safe everywhere."
- **Cheaper control to reach for first, everywhere:** scoped, least-privilege, **rotatable** keys — read-only DB roles, per-service tokens, short TTLs. That blunts "the agent leaked a key" at a fraction of the cost of a TLS-intercepting proxy, and it's worth doing regardless.

> One line: **the agent should hold placeholders, not secrets — but a TLS-intercepting broker is a trusted component you own, not a magic wand. Adopt it when the keys are worth stealing, on infra you control.**

---

## SEO/GEO — enforce the mechanics, vendor the authoring

There are two halves to SEO/GEO, and they get handled differently here — the distinction matters.

**Mechanics are _enforced_, not a skill.** `@stack/seo` is the one door for page metadata + JSON-LD, `bun run check:seo` fails the build if a public page drifts, and the CLAUDE/AGENTS laws spell out the rules (see [`AGENTS.md`](../../AGENTS.md) § 3.1). An enforced gate in CI beats a skill an agent may or may not read — so **don't vendor a skill for the mechanics** (metadata, canonical, robots/sitemap, JSON-LD plumbing). Skip the mechanics-flavored marketing skills (`seo-audit`, `schema`) — the gate owns them.

**But the gate can't write _content_.** Getting _cited_ by AI answers — answer-first blocks, comparison tables, corroborated stats, honest "when-NOT-to-use" — is authoring judgment no regex can check. That half **is** worth a vetted skill: [`ai-seo`](../../agents/skills/ai-seo/) (GEO / AEO / LLMO), cherry-picked from `coreyhaines31/marketingskills` (Tier-1), pinned to a commit + vetted through the 5-step law. Gate = plumbing; `ai-seo` = content. They compose. So the rule isn't "skip any SEO skill" — it's **enforce the mechanics, vendor the authoring.**

Other categories where a skill **is** worth adding for cloners (nothing here covers them): **security, testing, a11y, performance, DevOps, UI/UX, design, marketing.** Vet each one through the 5-step law before it lands.
