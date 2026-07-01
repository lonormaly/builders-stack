// Single public door for @stack/db.
export { db } from "./client";
export * from "./schema";
// Better Auth's tables (user/session/account/verification) — @stack/auth wires
// its Drizzle adapter to these so sign-up / sign-in persist to Postgres.
export * from "./auth-schema";
// Common query operators, re-exported so consumers stay on one door (no direct drizzle-orm import).
export { eq, and, or, desc, asc, sql } from "drizzle-orm";
