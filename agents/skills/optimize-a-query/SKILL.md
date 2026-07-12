---
name: optimize-a-query
description: Diagnose and fix a slow Postgres query in the builders-stack — read its EXPLAIN plan, find the missing index or the ORM N+1, and confirm the fix. Use when a page or endpoint is slow, a query times out, or pg_stat_statements shows a hot query. Pairs with design-a-schema for the index itself.
---

# Optimize a query

Measure, don't guess. A slow query is almost always a sequential scan that should be an index scan, or an ORM that fired N queries where one would do. Both are visible — you just have to look.

## When to use

- An endpoint/page is slow and you've traced it to a specific query.
- A query times out or `pg_stat_statements` shows it as a top consumer.
- Fixing the query needs a new/changed index → do the index work in [`design-a-schema`](../design-a-schema/SKILL.md).

## 1. Read the plan

Run the actual query with a plan (via `psql` against your `DATABASE_URL`, or Drizzle's logger):

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;
```

What to look for:

- **`Seq Scan` on a big table** where you filter/join → **missing index**. The fix is an index (usually on the FK or the filtered column), not a query rewrite.
- **`Rows Removed by Filter` ≫ rows returned** → the index isn't selective, or a partial index would help.
- **Estimated rows wildly off actual** → stale stats: `ANALYZE <table>;` (autovacuum usually handles this).
- **Nested Loop over many rows** → often the ORM N+1 below, not a single bad query.

## 2. Catch the ORM N+1

The most common "slow page" in this stack isn't one slow query — it's **many fast ones**. Loading a list and then fetching each row's relation in a loop fires 1 + N queries.

- **Symptom:** the same short query in the logs, repeated with different ids.
- **Fix:** use Drizzle's relational query with `with` (one join-backed query), or a single `inArray(...)` batch — never a `for` loop of `db.query`.

```ts
// ❌ N+1
for (const p of posts) p.author = await db.query.user.findFirst({ where: eq(user.id, p.authorId) });
// ✅ one query
const rows = await db.query.posts.findMany({ with: { author: true } });
```

## 3. Find the hot queries you didn't know about

`pg_stat_statements` ranks queries by total time (Neon supports it — `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`):

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

The top rows are where an index or an N+1 fix pays off most.

## 4. Guardrail

Set a `statement_timeout` (per session or per role on Neon) so a pathological query fails fast instead of pinning compute:

```sql
ALTER ROLE app SET statement_timeout = '10s';
```

## Verify

Re-run `EXPLAIN (ANALYZE)` — the `Seq Scan` is now an `Index Scan`/`Index Only Scan`, actual time dropped, and the N+1 is a single query in the logs. If you added an index, confirm it's the minimal one that does the job (see `design-a-schema` — don't over-index).

## References

- `EXPLAIN` output, explained: <https://www.postgresql.org/docs/current/using-explain.html>
- `pg_stat_statements`: <https://www.postgresql.org/docs/current/pgstatstatements.html>
- Drizzle relational queries (avoid N+1): <https://orm.drizzle.team/docs/rqb>
