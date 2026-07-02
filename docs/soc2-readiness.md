# SOC 2 readiness — what the stack gives you, what you still owe

**Read this honestly: a template gives you readiness, not a report.** SOC 2 is an audit of
your _operating_ controls over a period (Type II) or at a point in time (Type I), signed by a
licensed CPA firm. Code can implement the technical controls; it cannot write your policies,
run your monitoring, collect your evidence, or be your auditor. This doc maps the stack to the
**Trust Service Criteria** (the Common Criteria, CC-series) so you know exactly which line
items are already wired and which are on you.

Legend: **✅ wired** (in this repo) · **🔨 partial** (pattern shipped, you extend) · **📋 yours**
(process/policy a template can't do).

## Common Criteria map

| TSC           | Criterion                       | Status | Where / what to do                                                                                                                                                             |
| ------------- | ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CC6.1**     | Logical access — authentication | ✅     | Better Auth (`@stack/auth`) — email/password + GitHub OAuth, sessions in Postgres.                                                                                             |
| **CC6.1**     | Access control — authorization  | 🔨     | Session guard on protected routes (`/me`, data-rights). Add RBAC/roles for real tiers.                                                                                         |
| **CC6.1**     | Encryption in transit           | 🔨     | HTTPS terminates at your edge (Cloudflare/host). Enforce HSTS + TLS-only at deploy.                                                                                            |
| **CC6.1**     | Secrets management              | ✅     | Infisical as source of truth (`docs/secrets.md`); `.env.local` git-ignored; env-gated code.                                                                                    |
| **CC6.1**     | Secret leakage prevention       | ✅     | **gitleaks** CI gate (`.gitleaks.toml` + `ci.yml`) — a committed secret fails the build.                                                                                       |
| **CC6.6**     | Boundary protection             | 🔨     | CORS pinned to `WEB_ORIGIN` (`@stack/config`); Nx module boundaries. Add WAF/rate limits.                                                                                      |
| **CC6.7**     | Data at rest                    | 📋     | Managed Postgres (Neon) + R2 encrypt at rest by default — confirm + document per vendor.                                                                                       |
| **CC7.1**     | Vulnerability management — deps | ✅/🔨  | **Dependabot** (all workspace `package.json`) + **osv-scanner** CI job. Bun's binary lockfile limits OSV's JS coverage → Dependabot is primary (see caveat below).             |
| **CC7.1**     | Vulnerability management — code | ✅     | Oxlint (correctness=error, incl. **jsx-a11y**) + type-aware rules gate every PR.                                                                                               |
| **CC7.2**     | Monitoring / anomaly detection  | 🔨     | PostHog product analytics + error tracking (`captureServerException`); **audit trail** via `securityEvent()` (structured stdout on sign-in). Add alerting on the audit stream. |
| **CC7.3–7.5** | Incident response               | 📋     | Write the runbook: who's paged, severities, comms, post-mortems.                                                                                                               |
| **CC8.1**     | Change management               | ✅/📋  | Branch protection + PR review + CI (lint/typecheck/test/build/secret+vuln scan). Document the policy + require approvals in GitHub settings.                                   |
| **CC1.x**     | Control environment / org       | 📋     | Org chart, roles, security ownership, background checks, onboarding/offboarding.                                                                                               |
| **CC2.x**     | Communication                   | 📋     | Security policy, acceptable-use, published `SECURITY.md` (present) — formalize + distribute.                                                                                   |
| **CC3.x**     | Risk assessment                 | 📋     | Annual risk assessment + risk register.                                                                                                                                        |
| **CC9.2**     | Vendor / supply-chain mgmt      | ✅/📋  | Skill/MCP vet law (`AGENTS.md § 7.1`) + pinned CI actions + Dependabot. Add a vendor inventory + DPAs.                                                                         |

## What's wired in this repo (the technical controls)

- **Secret scanning** — `gitleaks/gitleaks-action` in CI, config in `.gitleaks.toml`. A real
  committed secret fails the build. (Allowlist covers build output + `.env.example` placeholders.)
- **Dependency scanning** — `.github/dependabot.yml` (weekly, every workspace package + the
  Actions themselves) and the `osv-scanner` CI job.
- **Audit logging** — `securityEvent(actorId, event, props)` in `@stack/analytics/events`:
  writes a structured JSON line to stdout (durable, aggregator-friendly) **and** returns a
  PostHog-capture payload. Wired at the sign-in choke point (`libs/auth`, `session.create.after`).
  `auth_signed_out` + `auth_login_failed` are in the catalog, ready to wire the same way.
- **Access control** — Better Auth; protected routes check the session (`services/api` `/me`).
- **Change management** — CI (`.github/workflows/ci.yml`): oxlint (a11y), oxfmt, check:seo,
  Nx boundaries + typecheck + test + build, gitleaks, osv-scanner.

### Honest caveat — bun binary lockfile vs OSV

Bun 1.1.x writes a **binary `bun.lockb`** that osv-scanner can't parse, so the OSV job's
**JavaScript** dependency coverage is limited (it still gates GitHub Actions pins, Dockerfiles,
and any text lockfiles). **Dependabot is the primary JS dep-update/alert mechanism** here. When
you move to bun ≥ 1.2 (text `bun.lock`), OSV gains full JS coverage — no config change needed.

## What you still owe (no template can do these)

1. **Written policies** — infosec, access control, change management, incident response,
   data retention, vendor management, BCP/DR. Auditors read the policy, then check you follow it.
2. **Formal monitoring + alerting** — route the `securityEvent()` audit stream + error tracking
   to a log store with alerts (failed-login spikes, privilege changes). "We log" isn't "we monitor."
3. **Evidence collection** — screenshots, access reviews, ticket links, CI logs, over the whole
   audit period. A compliance platform (Vanta/Drata/Secureframe) automates most of this.
4. **Vendor management** — inventory every subprocessor (host, DB, email, analytics, payments),
   collect their SOC 2 / DPAs, review annually.
5. **An auditor** — a licensed CPA firm performs the examination and issues the report. Budget a
   readiness period (usually 3–6 months for Type II) before the audit window opens.

**Bottom line:** the repo covers the engineering half of the CC-series. The other half is
operational discipline + paperwork + an auditor. This doc is your gap list.
