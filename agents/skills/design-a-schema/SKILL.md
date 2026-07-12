---
name: design-a-schema
description: Model a new table (or reshape an existing one) in libs/db with Drizzle — normalize by default, add the right constraints, and index deliberately. Use when adding a table/column, deciding on keys and foreign keys, or when a query is slow because the schema or its indexes are wrong. Enforces the stack's "Drizzle is the only DB layer" and "index FKs, don't over-index" rules.
---

# Design a schema

Get the data model right before the app is built on top of it — a bad schema is the most expensive thing to change later, and on Neon's free tier it's also what quietly eats your 0.5 GB and your compute. Normalize first, constrain always, index on purpose.

## When to use

- Adding a table or column to `libs/db/src/schema.ts`.
- Choosing keys, foreign keys, uniqueness, or an index strategy.
- A query is slow and the cause is the schema (missing index, wrong shape), not the query text — pair with [`optimize-a-query`](../optimize-a-query/SKILL.md).

## Normalize first (then denormalize with a reason)

- **Default to 3NF.** One fact in one place. A value that can be derived or looked up should not be copied into another row — copies drift (update anomalies).
- **Denormalize only deliberately**, with a comment saying why (a measured hot read path, a reporting rollup). Never "just in case."
- **One row = one entity.** Repeating groups (`tag1`, `tag2`, `tag3`) become a child table with a FK.

## Constrain at the database, not just the app

The DB is the last line of integrity — app validation can be bypassed, a bad migration can't.

- `NOT NULL` on everything that is logically required.
- **Foreign keys** for every real relationship, with an explicit `onDelete` (`cascade` for owned children, `restrict`/`set null` otherwise). See `session`/`account` in `auth-schema.ts` — `onDelete: "cascade"` on `user.id`.
- `unique` on natural keys (email, slug). `check` constraints for enums/ranges Drizzle can express.

## Index deliberately — the part everyone gets wrong

- **Postgres does NOT auto-index foreign keys.** Add an index on every FK column you `JOIN` or filter on. A missing FK index is the classic "fine in dev, dies under load" bug.
- **Composite index column order matters:** put the equality-filtered column first, the range/sort column second. An index on `(user_id, created_at)` serves `WHERE user_id = ? ORDER BY created_at` — the reverse order does not.
- **Partial indexes** for queries that always filter (`WHERE deleted_at IS NULL`) — smaller, cheaper.
- **Do NOT add speculative indexes.** Every index slows writes and costs storage against the **0.5 GB free cap** (see [`run-lean-on-neon`](../run-lean-on-neon/SKILL.md)). Index what a real query needs; drop indexes nothing uses.

In Drizzle, declare indexes in the table definition so they land in a migration:

```ts
export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("posts_author_created_idx").on(t.authorId, t.createdAt)], // FK + sort, one index
);
```

## Then ship it as a migration

Schema is only real once it's a reviewed Drizzle migration — never hand-write SQL. Follow the `dba` subagent flow: edit `schema.ts` → `bun --filter @stack/db generate` → **read the SQL diff** → export new tables/types from `src/index.ts`.

## Verify

- `bun --filter @stack/db generate` produces a migration whose SQL matches your intent (no surprise DROP).
- Every FK you query on has an index. No index exists that no query uses.
- `bun run typecheck` passes; consumers import the new type by package name (`@stack/db`).

## References

- Use The Index, Luke — the practical guide to indexing: <https://use-the-index-luke.com>
- Postgres indexes: <https://www.postgresql.org/docs/current/indexes.html>
- Drizzle schema + indexes: <https://orm.drizzle.team/docs/indexes-constraints>
