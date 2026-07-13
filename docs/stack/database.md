# Choosing your database — why Neon, and when to actually swap

This stack ships **Postgres via Drizzle** (`libs/db`). This page is the honest version of "should I use something else?" — not a feature grid, but what actually changes, what it actually costs, and the real failure mode each option trades for.

## The one decision that reframes everything

Your app never talks to "Neon." It talks to **Drizzle over a `DATABASE_URL`** (`libs/db/src/client.ts`). That single seam means the two things people lump together are actually very different in cost-to-change:

- **Swapping the Postgres _host_** (Neon → Supabase / RDS / a VPS) is a **connection-string change**. Same schema, same queries, same Drizzle. Minutes.
- **Changing the _paradigm_** (Postgres → Mongo / Convex / Firestore) is a **rewrite of the data layer**. You delete `libs/db`, lose SQL joins and cross-entity transactions, and rebuild every query. Weeks.

So the real question is never "Neon vs X." It's: **do I stay relational (cheap swap) or leave it (expensive rewrite)?** Everything below is organized by that line.

> Numbers change constantly — every figure here has a source link; re-check before you rely on one. Verified figures are dated where it matters.

---

## Why Neon is the default

Neon is serverless, managed Postgres 16 that separates storage from compute. Three concrete reasons it's the default for _this_ stack, and the real tradeoff of each:

**1. Scale-to-zero → an idle DB costs $0.** Compute autosuspends after 5 min idle. For a pre-launch or low-traffic app this is the difference between "free" and "paying for an idle instance 24/7." The real tradeoff: a **~0.3–1s cold start** on the first query after suspend. Mitigate it the way this stack already does — keep `session.cookieCache` on so auth doesn't wake the DB on every request, and use the pooled endpoint. ([scale-to-zero docs](https://neon.com/docs/introduction/scale-to-zero))

**2. Branching → a real preview DB per PR.** `neonctl branches create` makes a copy-on-write clone of production data in seconds. Your CI can give every PR its own database seeded with prod-shaped data, then drop it on merge. The alternative on RDS is a snapshot-restore measured in minutes and dollars. This is a genuine workflow advantage, not a checkbox.

**3. It's plain Postgres.** No dialect lock-in — `pgvector`, `pg_stat_statements`, JSONB, full-text all work, and Drizzle's `pg` dialect is unmodified. Which is exactly why "swap the host later" stays a one-line change.

**The honest caveat:** the free tier's **compute (CU-hours) is the ceiling, not storage** — an always-on/polled DB burns the monthly 100 CU-hours in ~4 days. That's not a Neon flaw, it's the thing [`run-lean-on-neon`](../../agents/skills/run-lean-on-neon/SKILL.md) exists to manage (don't poll, cache the session, let it sleep).

---

## Bucket A — swap the Postgres host (keep Drizzle)

Same relational stack. What you change is the `DATABASE_URL` (and occasionally `drizzle.config.ts`). Pick by the one thing each does better than Neon — and mind the specific gotcha, because each has one.

### Supabase — Postgres + a batteries bundle

- **What it really is:** managed Postgres **plus** its own auth (GoTrue), storage, realtime, and PostgREST auto-API.
- **Real numbers (free, 2026):** 500 MB DB, **2 active projects**, **paused after 1 week of inactivity**, no automatic backups, 50k MAU on _its_ auth (which you're not using), 5 GB egress. ([pricing](https://supabase.com/pricing))
- **The real gotcha:** its pooler (Supavisor, port 6543) runs in **transaction mode**, which breaks prepared statements. With this stack's `postgres.js` driver you must set `prepare: false` in `libs/db/src/client.ts` or you'll get `prepared statement "s1" already exists` under load. That's the actual line of code the swap costs.
- **When it genuinely wins:** you _want_ the bundle — Supabase Realtime for live features, Supabase Storage instead of R2, its RLS-based auth. But note that's in tension with the stack's choices (Better Auth, R2, PostHog): you'd be adopting Supabase's ecosystem, not composing best-of-breed. Pick it if that's the trade you want, not for "it's also Postgres."

### CockroachDB — distributed Postgres

- **What it really is:** Postgres-**wire**-compatible (not 100% feature-compatible), horizontally distributed, survives a zone/region failure, serializable by default.
- **The real gotchas:** no stored procedures; `SERIAL`/sequences behave differently (use UUIDs or `unique_rowid()`); some `information_schema`/extension gaps; and — the big one — **serializable isolation means transactions can fail with retry error `40001`, and your app must retry them**. That's real code you write that you don't write on Neon. Drizzle works, but avoid PG-specific extensions.
- **Free:** CockroachDB Cloud Serverless (verify current allotment at [pricing](https://www.cockroachlabs.com/pricing/)).
- **When it genuinely wins:** you actually need multi-region low-latency writes or datacenter-failure survival. Rare for a startup. Adopting it "for scale" you don't have yet just buys you the retry-loop tax early.

### Self-hosted Postgres on a VPS (Hetzner / DO / Fly)

- **What it really is:** you run `postgres:16` on a box you own. A Hetzner CX22 is ~€4/mo for 4 GB RAM / 2 vCPU / 40 GB SSD.
- **The one place the YouTube/PgTune advice is finally correct:** here you _own_ `postgresql.conf`, so the whole tuning playbook applies — `shared_buffers ≈ 1GB` (25% RAM), `effective_cache_size ≈ 3GB`, `work_mem`, `max_wal_size`, `checkpoint_timeout`. On Neon that advice is inert; on your own box it's the job.
- **What you now own (the real cost):** backups (`pg_dump` cron or WAL-G to object storage — nobody does this for you), HA (none unless you build a replica + failover), security patching, and connection pooling (run PgBouncer yourself, or put **Cloudflare Hyperdrive** in front so Workers don't storm it). And it **never scales to zero** — you pay for the box 24/7 even at 3am with zero traffic.
- **When it genuinely wins:** predictable cost at steady mid-size scale (a €4 box beats usage-based billing for a consistent workload), full control, or learning ops. **When it loses:** you're now the on-call DBA.

### Managed classics — RDS/Aurora, Cloud SQL, Fly Postgres, Railway, Render

- **RDS / Aurora:** reach for these when you're standardizing on AWS, need a VPC-private DB, or have compliance requirements. Note **Aurora Serverless v2 has no true scale-to-zero** — its floor was long 0.5 ACU (~$43/mo) before a later cold-start option; verify, but the point stands: it's not "free when idle" like Neon.
- **Railway / Render:** easiest DX, but **no branching**, and Render's free Postgres **expires after 90 days** (a real "my demo died" gotcha). Fine for a quick throwaway, not the long-lived default.

### Cloudflare D1 — the edge-native option (SQLite, not Postgres)

- **The catch that puts it half-out of Bucket A:** D1 is **SQLite**, so it's a **dialect change**, not a connection-string swap. Drizzle supports it via `drizzle-orm/d1`, but you rewrite the schema (`sqliteTable`, not `pgTable`), lose Postgres types/extensions (no JSONB operators, no `pgvector`), and change some SQL.
- **Real numbers (free):** 10 databases, **500 MB max per DB**, 5 GB per account, 50 queries per Worker invocation, 100 KB max statement. ([limits](https://developers.cloudflare.com/d1/platform/limits/))
- **When it genuinely wins:** edge-first, read-heavy, simple relational schema, reads co-located with your Workers for near-zero latency. **When it loses:** you need real Postgres features — then it's the wrong engine.
- **Related, not a database:** **Hyperdrive** pools + caches an _external_ Postgres from Workers. If you self-host or use RDS behind Cloudflare, Hyperdrive is how you kill the connection-storm and latency. Free.

---

## Bucket B — change the paradigm (you leave Drizzle)

Now you're deleting `libs/db` and rebuilding. Only do this when the paradigm is genuinely a better fit — not for a benchmark number.

### MongoDB — document store

- **What you'd actually rip out:** Drizzle and SQL joins. Better Auth _does_ have a Mongo adapter, so auth is portable, but every cross-entity read becomes `$lookup` or app-side stitching, and you lose multi-row ACID transactions across collections as the default posture.
- **The counter you should try first:** Postgres already does documents — a `jsonb` column with a **GIN index** and containment queries (`WHERE data @> '{"type":"x"}'`) covers most "I want flexible/nested documents" cases without leaving SQL. Reach for Mongo only when your data is document-**native** (heterogeneous per-record shapes — CMS trees, product catalogs whose attributes differ per category), high write-fan-out, and you rarely need cross-entity transactions.
- **Verdict for a relational SaaS SSOT:** usually a **secondary** store for the document-shaped corner, not the source of truth. (This is why the stack is Postgres-only and the DBA agent excludes Mongo.)

### Convex — reactive backend-as-a-service

- **What it really is:** you write TypeScript query/mutation functions against Convex's own transactional document store, and clients **subscribe** — realtime + optimistic updates come for free, plus scheduling and file storage.
- **What you'd actually rip out:** both `services/api` **and** `libs/db`. Your backend becomes Convex functions, not Hono routes + Drizzle. You trade portable SQL for a proprietary reactive runtime.
- **When it genuinely wins:** the reactivity _is_ the product — multiplayer/collaborative apps, live dashboards, chat — where you'd otherwise hand-build a subscription/WebSocket layer. **The lock-in is real:** leaving is a rewrite, not a connection string.

### Firebase / Firestore — NoSQL + realtime + Google auth

- **When it genuinely wins:** mobile-first MVP wanting offline sync + realtime out of the box on the Google ecosystem.
- **The real costs:** the query model is weak — no joins, limited compound queries, and you must **model every access pattern up front** (data duplication + a composite index per non-trivial query). Pricing is **per document read/write/delete**, so a poorly-modeled list view = N reads = a surprise bill. Total vendor lock-in, and it competes with Better Auth. For a relational SaaS SSOT: no.

### InstantDB — "modern Firebase," relational-ish + realtime

- **When it genuinely wins:** realtime, client-first, local-first-feeling apps that want instant optimistic UX with minimal backend. You query from the client with a permission layer.
- **The caveat:** young, smaller ecosystem, and still a paradigm shift off server-side Drizzle/Hono.

---

## The decision, concretely

1. **Do you need SQL joins, cross-entity transactions, or relational integrity?** → **Stay Postgres (Bucket A).** This is ~90% of SaaS, including this stack (auth ↔ sessions ↔ accounts, billing ↔ subscriptions ↔ entitlements).
2. **Within Postgres, default Neon.** Then override only for a specific need:
   - Multi-region writes / DC-failure survival → **CockroachDB** (accept the retry code).
   - You want the batteries bundle (its realtime/storage/auth) → **Supabase** (accept fighting the stack's choices + `prepare: false`).
   - Predictable cost at steady scale + you'll run ops → **self-host** (you get PgTune back, you own backups).
   - Edge-first, simple schema, latency-critical reads → **D1** (accept SQLite dialect).
   - On AWS / need VPC-private / compliance → **RDS/Aurora** (accept no scale-to-zero).
3. **Is realtime collaboration the product itself?** → **Convex** (accept the rewrite).
4. **Is your data genuinely document-native and non-relational?** → **JSONB in Postgres first**; **MongoDB** only if that's insufficient.
5. **Mobile-first + offline sync + lock-in acceptable?** → **Firebase**.

## The escape hatch, in actual steps

**Bucket A (host swap), e.g. Neon → self-hosted or Supabase:**

1. Point `DATABASE_URL` at the new host (for Supabase, the Supavisor pooler string on port 6543).
2. If the driver hits a transaction-mode pooler, set `prepare: false` where `postgres(url)` is created in `libs/db/src/client.ts`.
3. `bun --filter @stack/db migrate` against the new DB. Done — no app code changes.

**Bucket B (paradigm change):** there is no step list. You rewrite `libs/db`, most of `services/api`, and every query. Budget weeks, and only start once you're certain the relational model is the wrong fit — not because a write-throughput benchmark looked bad (that's almost always a tuning/connection artifact, as the "MongoDB beats Postgres" benchmarks turn out to be).

---

_Verified July 2026 against the linked sources; providers change tiers constantly — re-check before you commit to a number._
