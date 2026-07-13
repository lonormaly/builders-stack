// @stack/api — Hono + @hono/zod-openapi.
//   GET  /health          liveness
//   GET  /openapi.json     generated OpenAPI 3.1 doc
//   GET  /docs             Swagger UI (reads /openapi.json)
//   *    /api/auth/*       Better Auth handler (@stack/auth)
//   GET  /me               protected — current user (401 if signed out)
//   CRUD /posts            example resource, zod-validated, backed by @stack/db
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { auth } from "@stack/auth";
import { db, user, eq } from "@stack/db";
import { getEnv } from "@stack/config";
import { captureServerException } from "./analytics.js";
import { reportError } from "@stack/observability";
import {
  listRoute,
  createPostRoute,
  getRoute,
  patchRoute,
  deleteRoute,
  repo,
  toApi,
} from "./posts.js";

// Refuse to start with an unset auth secret outside dev: an empty secret signs sessions
// with a blank key — trivially forgeable. Import-time "" fallback stays (build/typecheck),
// runtime is guarded here.
if (process.env.NODE_ENV !== "development" && !process.env.BETTER_AUTH_SECRET) {
  console.error("[api] FATAL: BETTER_AUTH_SECRET is not set. Refusing to start.");
  process.exit(1);
}

const app = new OpenAPIHono();

// Reject oversized bodies before parsing — a large JSON payload is a cheap DoS vector.
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
app.use("*", async (c, next) => {
  if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }
  await next();
});

// Baseline security response headers on every route. No CSP here — a real CSP needs a
// per-app nonce + allowlist (PostHog, Clarity, Tailwind) and belongs in each Next app;
// these are the zero-risk headers that apply uniformly to an API origin.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
});

// CORS so the web app can call /api/auth + protected routes WITH cookies. The origin
// comes from the typed env door (@stack/config) — declared once, no inline default here.
app.use("*", cors({ origin: getEnv().WEB_ORIGIN, credentials: true }));

// --- liveness ---
app.get("/health", (c) => c.json({ status: "ok", service: "api", uptime: process.uptime() }));

// --- Better Auth: catch-all under /api/auth/* ---
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// --- protected route: proves the auth guard works ---
app.get("/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return c.json(session.user);
});

// --- GDPR data rights (STARTER) — access (export) + erasure (delete) ---
// Both act on the caller's OWN session only. Starter scope: the Better Auth `user` row
// (deleting it cascades sessions + accounts via FK `onDelete: "cascade"`). Before you rely
// on these for a real DSAR, widen them to your app-owned tables (posts, …) and add an audit
// log + confirmation flow. See docs/gdpr.md § "Data rights".
app.get("/me/export", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const [row] = await db.select().from(user).where(eq(user.id, session.user.id));
  return c.json({ exportedAt: new Date().toISOString(), user: row ?? null }, 200, {
    "Content-Disposition": 'attachment; filename="my-data.json"',
  });
});

app.post("/me/delete", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  // Erasure: remove the user row; sessions + accounts cascade. Starter — extend to app data.
  await db.delete(user).where(eq(user.id, session.user.id));
  return c.json({ deleted: true, userId: session.user.id }, 200);
});

// --- posts CRUD ---
// Reads are public; writes require a session and are scoped to the author. authorId is
// ALWAYS derived from the session, never the body — accepting it from the client is BOLA.
app
  .openapi(listRoute, async (c) => c.json((await repo.list()).map(toApi), 200))
  .openapi(createPostRoute, async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const created = await repo.create({ ...c.req.valid("json"), authorId: session.user.id });
    return c.json(toApi(created), 201);
  })
  .openapi(getRoute, async (c) => {
    const post = await repo.get(c.req.valid("param").id);
    return post ? c.json(toApi(post), 200) : c.json({ error: "Not found" }, 404);
  })
  .openapi(patchRoute, async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const existing = await repo.get(c.req.valid("param").id);
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.authorId !== session.user.id) return c.json({ error: "Forbidden" }, 403);
    const updated = await repo.update(c.req.valid("param").id, c.req.valid("json"));
    return updated ? c.json(toApi(updated), 200) : c.json({ error: "Not found" }, 404);
  })
  .openapi(deleteRoute, async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const existing = await repo.get(c.req.valid("param").id);
    if (!existing) return c.json({ error: "Not found" }, 404);
    if (existing.authorId !== session.user.id) return c.json({ error: "Forbidden" }, 403);
    const ok = await repo.remove(c.req.valid("param").id);
    return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404);
  });

// --- OpenAPI doc + Swagger UI ---
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { version: "1.0.0", title: "@stack/api", description: "Builders-stack reference API." },
});
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// --- error tracking: uncaught route errors → PostHog (product) + Better Stack (ops).
// Both no-op without their key/token; reportError also writes the stderr line. ---
app.onError((err, c) => {
  captureServerException(err);
  reportError(err, { service: "api", path: c.req.path });
  return c.json({ error: "Internal Server Error" }, 500);
});

// PORT is injected by portless in local dev (stable URL: api.stack.localhost:1355);
// falls back to 3001 for standalone `bun --filter @stack/api dev`.
const port = Number(process.env.PORT) || 3001;
console.log(`[api] listening on http://localhost:${port}  (docs: /docs)`);

export default { port, fetch: app.fetch };

// The full app type — the second way to stay in sync with the frontend. @stack/api-types
// gives shared zod types for plain fetch; this gives a fully-typed Hono RPC client:
// `hc<AppType>(API_URL)` in apps/web has every route + its params/response typed end to
// end, no codegen. See docs/nx.md (Contracts).
export type AppType = typeof app;
