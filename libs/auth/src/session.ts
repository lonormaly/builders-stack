import { auth } from "./auth";

/**
 * Server-side session lookup. Pass the incoming request `Headers`
 * (e.g. `req.headers` in Hono, `headers()` in Next.js) and get back the
 * session + user, or `null` when unauthenticated.
 */
export function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
