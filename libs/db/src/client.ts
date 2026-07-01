import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

// App tables + Better Auth tables in one schema so both the relational query
// API (db.query.*) and the Better Auth Drizzle adapter see every table.
const schema = { ...appSchema, ...authSchema };

// Defaults to the docker-compose Postgres so `./tilt_up.sh` boots with zero extra setup.
// postgres.js connects lazily — the API serves /health + OpenAPI even before Postgres is up,
// and a bad URL fails clearly at query time. Set DATABASE_URL in .env.local for real use.
const url =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/builders_stack";

// Passing `schema` enables the relational query API: db.query.users.findMany(...).
const client = postgres(url);
export const db = drizzle(client, { schema });
