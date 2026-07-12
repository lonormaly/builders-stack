---
name: run-lean-on-neon
description: Keep Postgres fast under load and inside Neon's free tier. Use when choosing a connection string, worrying about "the DB crashes at load", deciding a session strategy, or trying to stay under Neon's free limits (storage / compute-hours). Corrects the common mistake of reaching for postgresql.conf / PgTune — most of that does not apply on Neon.
---

# Run lean on Neon

The stack's prod DB is **Neon** (serverless, managed Postgres). That changes the whole "tune Postgres" story: **you do not own a `postgresql.conf`**, so most classic advice (PgTune output — `shared_buffers`, `checkpoint_timeout`, `max_wal_size`, `maintenance_work_mem`) **does not apply** — Neon manages it. What you _do_ control is connections, the query/schema shape, a few session GUCs, and how often the app wakes the compute. Those are where "crashes at load" and "blew the free tier" actually come from.

## When to use

- Picking a connection string, or the DB falls over under concurrency.
- Choosing how auth/session validation talks to the DB.
- Staying inside Neon's free tier (storage or compute).

## Neon free tier — the limits that bind (verify at <https://neon.com/pricing>, they change)

| Limit       | Free                                      | What it means                                                          |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Storage     | **0.5 GB / project**                      | overflow → **writes fail**. Don't put blobs in Postgres.               |
| Compute     | **100 CU-hours / mo** (~400 h at 0.25 CU) | overflow → **compute suspended till next month**. The real bottleneck. |
| Autosuspend | after **5 min** idle (can't disable)      | your friend — an idle DB costs zero compute.                           |
| Branches    | **10 / project**                          | prune dev branches; change history counts toward storage.              |

## Compute (CU-hours) — the bottleneck. Don't wake the DB for nothing.

An idle client makes **zero** requests → compute suspends → CU-hours preserved. Everything that _pins compute awake_ is the enemy:

- **Never poll or keepalive the DB.** This is the stack's "push, don't poll" law applied to Postgres — a `setInterval` health-ping or a per-minute cron holds compute open 24/7 and burns all 400 hours. Use SSE/WebSocket for status, let the DB sleep.
- **Cache the session cookie** — the single biggest saver. Better Auth's `getSession` runs on nearly every request; each one is a DB round-trip that keeps compute awake. `session.cookieCache` (ON by default in `libs/auth`) serves the session from a signed 5-min cookie and only touches the DB on miss. **Do not extend the TTL to "save more" — it's a revocation dial, not a cost dial** (see the session ladder below).
- **Batch background work** into one wake instead of trickling writes.

## Storage (0.5 GB) — and the tension with indexing

- **No blobs in Postgres** — files/images go to object storage (R2/S3), store the URL.
- **Prune telemetry/log tables** — rotate or offload; they grow unbounded and eat the cap.
- **Indexes cost storage.** [`design-a-schema`](../design-a-schema/SKILL.md) says index every FK you query — true — but on the free tier that's a budget: index what real queries need, **drop indexes nothing uses**. Don't index speculatively.
- Let autovacuum reclaim dead tuples; long-lived branches with heavy churn inflate change history.

## Connections — what actually "crashes Postgres at load"

Not WAL tuning — **connection storms**. Free-tier compute is small (0.25 CU) so `max_connections` is low; a burst of serverless function instances each opening a direct connection exhausts it instantly.

- **Use Neon's pooled connection string** (the `-pooler` host — PgBouncer) for the app's `DATABASE_URL`. Use the direct (non-pooled) string only for migrations.
- One `postgres.js` client per process (as `libs/db/src/client.ts` does), not per request.

## Session strategy — the ladder (stop at the first rung that holds)

1. **`cookieCache` only (default).** Removes per-request Neon hits. Free, no new vendor, revocation ≤ 5 min. **Enough for most free-tier apps — stop here.**
2. **Cloudflare CDN** for public/cacheable routes (landing/blog/assets) — those never hit origin _or_ DB. Cannot cache authenticated per-user responses.
3. **`secondaryStorage` on Workers KV / DO** — _upgrade only_, when per-TTL Neon session reads become a measured cost or you want zero Neon coupling. **Mind KV's free cap: 1,000 writes/day** (every login/refresh/revoke is a write); DO-SQLite has more write headroom (100k/day) but more moving parts. Gains instant-ish revocation.
4. **Stateless JWT — no.** It optimizes the thing `cookieCache` already fixed (per-request DB hits) by sacrificing what you can't cheaply rebuild: **revocation**. A JWT can't be revoked before expiry without a denylist lookup — which is the stateful check you were removing.

## The GUCs you _can_ set on Neon (session/role level, not a conf file)

- `work_mem` — bump per role for heavy sort/hash queries (`ALTER ROLE app SET work_mem = '32MB'`). Default 4 MB is tiny.
- `synchronous_commit = off` — the honest "MongoDB mode": acknowledge commits before the WAL is durably flushed. **Per-transaction, for non-critical writes only** (telemetry, sessions) — a crash can lose the last fraction of a second (no corruption). Never for payments/orders.
- `statement_timeout` — cap runaway queries so they fail fast instead of pinning compute.

## Verify

- App `DATABASE_URL` uses the **pooled** endpoint; migrations use the direct one.
- `cookieCache` is enabled (`libs/auth`) — auth isn't hitting the DB per request.
- Nothing polls/keepalives the DB; no blobs in Postgres.
- You are **not** editing `postgresql.conf` or running PgTune (it doesn't apply here).

## References

- Neon pricing / plan limits: <https://neon.com/pricing>
- Neon connection pooling: <https://neon.com/docs/connect/connection-pooling>
- Neon autosuspend / scale-to-zero: <https://neon.com/docs/introduction/scale-to-zero>
- Better Auth cookie cache: <https://www.better-auth.com/docs/concepts/session-management#cookie-cache>
- Better Auth secondaryStorage: <https://www.better-auth.com/docs/concepts/database#secondary-storage>
