// @stack/observability — ship errors + structured logs to Better Stack (Logtail),
// env-gated like every other integration: no BETTERSTACK_SOURCE_TOKEN → stdout only,
// the service still boots and runs. This is the *in-app* drain (structured events,
// uncaught errors). For full log volume from a Workers/k8s deploy, prefer a
// platform drain (Cloudflare Logpush → Better Stack) — see docs/monitoring.md.
//
// Design rules that matter for telemetry: fire-and-forget (never block the request
// path), never throw (a logging failure must not become an app failure).

export type LogLevel = "info" | "warn" | "error";

/**
 * Log to stdout/stderr always (so a platform drain can also pick it up), and — only
 * when a source token is set — additionally POST the structured event to Better Stack.
 * Env is read per-call (not captured at import) so it's honored whenever it's set.
 */
export function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const line = `[${level}] ${message}`;
  if (level === "error") console.error(line, meta);
  else console.log(line, meta);

  const token = process.env.BETTERSTACK_SOURCE_TOKEN;
  if (!token) return; // env-gated: no token → no external drain (silent no-op).

  // Better Stack gives each source its own ingesting host; override when yours differs.
  const host = process.env.BETTERSTACK_INGEST_HOST ?? "https://in.logs.betterstack.com";
  void fetch(host, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ dt: new Date().toISOString(), level, message, ...meta }),
    keepalive: true,
  }).catch(() => undefined); // telemetry must never take down the request.
}

/** Report an unknown thrown value as an error event (message + stack + context). */
export function reportError(err: unknown, context: Record<string, unknown> = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  log("error", message, { ...context, stack });
}
