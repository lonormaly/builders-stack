import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Applies generated SQL from ./migrations. Programmatic (not `drizzle-kit migrate`)
// so app deploys can run it without the drizzle-kit dev dependency present.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — cannot run migrations.");
}

// ponytail: fresh max:1 client — the migrator's own recommendation; avoids pool
// races on DDL. Its own lifecycle, so we don't reuse the app client from client.ts.
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: "./migrations" });
await client.end();
console.log("migrations applied");
