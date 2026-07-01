import { inArray } from "drizzle-orm";
import { db, users, posts } from "./index";

// ponytail: needs a live DATABASE_URL and an existing schema (run `bun run push`
// or `bun run migrate` first). Users upsert on email so re-running is safe; posts
// are wiped-and-reinserted per author to keep the seed roughly idempotent.

async function upsertUser(email: string, name: string) {
  const [row] = await db
    .insert(users)
    .values({ email, name })
    .onConflictDoUpdate({ target: users.email, set: { name } })
    .returning();
  // noUncheckedIndexedAccess: returning() is T[], so [0] is T | undefined.
  if (!row) throw new Error(`failed to upsert user ${email}`);
  return row;
}

const alice = await upsertUser("alice@example.com", "Alice");
const bob = await upsertUser("bob@example.com", "Bob");

// Reset each author's posts so a re-run doesn't pile up duplicates.
await db.delete(posts).where(inArray(posts.authorId, [alice.id, bob.id]));
await db.insert(posts).values([
  { title: "Hello from Alice", body: "First post.", authorId: alice.id },
  { title: "Alice again", body: "Second post.", authorId: alice.id },
  { title: "Bob says hi", body: "Bob's only post.", authorId: bob.id },
]);

console.log("seeded 2 users and 3 posts");
process.exit(0);
