# GDPR — the patterns that are wired, and the checklist that's on you

The stack ships the **technical** GDPR patterns a template can implement. The **legal and
process** parts — the ones that actually make you compliant — a template cannot do. This doc
is both: what's in the code, then the checklist you own.

## What's wired in this repo

### 1. Consent-gated analytics (the big one)

Analytics are **off by default** and stay dormant until the visitor consents — no PostHog, no
Clarity, no cookies, no network calls before that. This is the difference between "we have a
cookie banner" and "we actually don't track without consent."

- `@stack/analytics` `consent.ts` — consent state in `localStorage` (`granted` / `denied` /
  undecided), with a `stack:consent-change` window event.
- `<Analytics/>` (`analytics.tsx`) — checks `hasConsent()` and **only** calls `posthog.init` /
  `Clarity.init` after consent is granted; it subscribes to the consent event so accepting the
  banner starts trackers live, no refresh.
- `<ConsentBanner/>` — the wired banner (`@stack/analytics`), rendering the dumb
  `@stack/ui` `<ConsentBanner/>`. Drop it next to `<Analytics/>` (done in `apps/landing`).
  Accept → `grantConsent()`; Reject → `denyConsent()` (remembered, trackers stay off).

To verify: load the landing page with `NEXT_PUBLIC_POSTHOG_KEY` set, open devtools → no
PostHog requests until you click **Accept**.

### 2. Privacy policy

`apps/landing/app/privacy/page.tsx` — a **template** privacy policy, server-rendered with
`@stack/seo` metadata (so it passes `check:seo`). It is clearly marked as a starting point,
not legal advice. Replace every `[bracketed]` value.

### 3. Data-rights endpoints (access + erasure)

`services/api` ships **starter** endpoints for the two rights people exercise most:

- `GET /me/export` — the caller's data as a JSON download (GDPR Art. 15 access / Art. 20
  portability). Starter scope: the Better Auth `user` row.
- `POST /me/delete` — deletes the caller's account (Art. 17 erasure); sessions + accounts
  cascade via FK. Starter scope: the `user` row.

Both require the caller's own session. **Before you rely on them for a real Data Subject Access
Request, widen them to your app-owned tables** (posts, uploads, …) and add a confirmation flow
plus an audit-log entry.

## The checklist you own (no template can do this)

- [ ] **Name a legal basis** for every processing activity (consent, contract, legitimate
      interest) and record it. Analytics here = consent; account data = contract.
- [ ] **Fill in the privacy policy** — controller identity, data collected, purposes, legal
      bases, retention periods, subprocessors, transfer mechanism, contact. Have counsel review.
- [ ] **Records of Processing Activities (RoPA)** — Art. 30. What you process, why, where it
      goes, how long you keep it.
- [ ] **Data Processing Agreements** with every subprocessor (hosting, DB, email, analytics,
      payments). Keep their signed DPAs.
- [ ] **International transfers** — if data leaves the EEA, put SCCs / an adequacy basis in place.
- [ ] **Retention + deletion policy** — actually delete data on schedule, not just on request.
- [ ] **Breach process** — the 72-hour notification runbook (who, what, to whom).
- [ ] **DSAR workflow** — a real process (identity verification, deadlines) behind the export/
      delete endpoints, not just the endpoints.
- [ ] **DPIA** for high-risk processing (large-scale profiling, special-category data).
- [ ] **Cookie inventory** — list every cookie/tracker the banner governs and keep it current.
- [ ] **Consent records** — if you need to prove consent, persist it server-side (the client
      `localStorage` flag here gates trackers; it is not an audit-grade consent record on its own).
- [ ] **Appoint a DPO** if your processing thresholds require one.

**Bottom line:** the code makes "don't track without consent," "here's the policy," and "export/
delete my data" real. Compliance is those plus the paperwork, the legal bases, and the process
behind them.
