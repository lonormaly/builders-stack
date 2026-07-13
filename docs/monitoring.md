# Monitoring — know when something's wrong (Better Stack)

PostHog tells you what users do and catches in-app exceptions. It does **not** tell you
_"is my endpoint reachable from the outside right now, and who gets paged when it isn't."_
That's a different job — external uptime checks, on-call alerting, a public status page,
and log aggregation. This stack points that job at **[Better Stack](https://betterstack.com)**
(Better Uptime + Logs/Logtail), which has a free tier that covers a real product.

Two layers, wired differently:

| Layer                             | What it answers                  | Setup                                        | Key needed?                     |
| --------------------------------- | -------------------------------- | -------------------------------------------- | ------------------------------- |
| **Uptime + alerts + status page** | "is it up? who's paged?"         | dashboard config against your `/health` URLs | **no** — external HTTP checks   |
| **Logs**                          | "what did it say when it broke?" | platform drain (primary) or in-app drain     | token only for the in-app drain |

---

## 1. Uptime monitoring — zero code, uses the `/health` endpoints you already have

Both services already expose a liveness endpoint:

- `services/api` → `GET /health` → `{ "status": "ok", "service": "api", "uptime": … }`
- `services/payment` → `GET /health` → `{ "status": "ok", "service": "payment", … }`

In Better Stack → **Monitors → Create monitor**, per deployed service:

1. **URL:** your deployed health URL (e.g. `https://api.your-domain.com/health`).
2. **Check frequency:** 3 min is fine on the free tier; 30s for critical paths on paid.
3. **Expected:** HTTP `2xx`. Optionally assert the body contains `"status":"ok"` so a
   process that's up but degraded (returns 500 from `/health`) still trips the alert.
4. **Regions:** pick ≥2 so a single probe's network blip doesn't page you.

**Don't** point a monitor at an authenticated route or a DB-touching endpoint on a tight
interval — on Neon that would pin compute awake and burn your free-tier CU-hours (see
[`docs/stack/database.md`](./stack/database.md) and the `run-lean-on-neon` skill). `/health`
is intentionally cheap and DB-free — keep monitors on it.

### Alerting (on-call)

Attach an **escalation policy**: who gets notified, how (email / SMS / phone / Slack /
webhook), and the wait-and-escalate ladder. Start simple — email + Slack to yourself — and
add a real rotation when there's a team.

### Status page

Better Stack turns those monitors into a **public status page** (`status.your-domain.com`)
for free. Wire it once; it updates itself from monitor state. This is what you link customers
to during an incident instead of fielding "is it down?" one by one.

---

## 2. Logs — platform drain first, in-app drain for structured events

There are two ways logs reach Better Stack. Use both, for different volume.

### (a) Platform drain — the primary route (recommended)

Your services log to **stdout/stderr**. On a real deploy, ship that stream at the platform
level — no app code, full volume, no added request latency:

- **Cloudflare** (where `apps/web` / `apps/landing` deploy): **Logpush → Better Stack**
  (HTTP destination). Configured in the Cloudflare dashboard / API, not in this repo.
- **Kubernetes** (services): a node/cluster log shipper (Vector, Fluent Bit) with a Better
  Stack sink, or the platform's native drain.

This captures everything the process prints, including the structured lines
`@stack/observability` already writes.

### (b) In-app drain — structured error events (`@stack/observability`)

For app-level events you want as **structured, queryable records** (uncaught route errors
with request context) even before a platform drain exists, the stack ships a tiny env-gated
drain: [`libs/observability`](../libs/observability). It's already wired into both services'
error paths:

```ts
// services/api — app.onError
reportError(err, { service: "api", path: c.req.path });
// services/payment — checkout catch
reportError(err, { service: "payment", route: "checkout" });
```

`reportError` / `log` **always** write to stdout (so the platform drain still sees them), and
**additionally** POST a structured JSON event to Better Stack **only when `BETTERSTACK_SOURCE_TOKEN`
is set**. No token → stdout only, the service still boots — the same "no key → no-op" contract
as every other integration. It's fire-and-forget and never throws: a logging failure must not
become an app failure.

To turn it on: create a **Logs → Source** in Better Stack, copy its **source token** into
`BETTERSTACK_SOURCE_TOKEN` (and `BETTERSTACK_INGEST_HOST` if your source's ingesting host
differs from the default). See [`.env.example`](../.env.example).

---

## Free tier & boundaries

- Free tier covers a real product: a handful of monitors, a status page, and a modest daily
  log volume — verify current limits at <https://betterstack.com/pricing>.
- **Boundary vs PostHog:** PostHog = product analytics, session replay, **in-app** error
  tracking. Better Stack = **external** uptime, on-call, status page, log aggregation. They
  overlap only loosely (both see errors); run both — they answer different questions.
- **Env-gated, like everything here:** no monitors configured = nothing watches (but nothing
  breaks); no `BETTERSTACK_SOURCE_TOKEN` = the in-app drain is a stdout-only no-op.
