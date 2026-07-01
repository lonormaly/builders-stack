// @stack/config — the single typed door to environment.
//
// The rule this enforces: never read process.env.X inline with a string default
// scattered across the codebase. Declare it ONCE here (name, type, default), then
// `getEnv().X` everywhere. One schema = one source of truth for what the app needs.
//
// Every field is optional or defaulted, so the app boots with an empty env in local
// dev (env-gated, non-breaking) and only real misconfig (e.g. a non-URL WEB_ORIGIN)
// fails fast at first read.
import { z } from "zod";

// Exported so it's directly unit-testable (parse valid → defaults, invalid → throws)
// without depending on the process-wide env or the getEnv() cache. See config.test.ts.
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Origin the browser app runs on — used by the API for CORS. Never hardcode it.
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  // Server-side PostHog (optional — absent = analytics no-op, see @stack/analytics).
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
});

export type Env = z.infer<typeof EnvSchema>;

// Parse once, cache. Lazy (not at import) so importing this never throws on a
// half-set env — it only validates the first time someone actually reads a value.
let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}
