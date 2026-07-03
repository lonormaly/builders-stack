// The root-credential store — modeled on ~/.aws/credentials.
//
// Root creds (a Cloudflare API token, a Neon key) are the same no matter which
// repo you're setting up, so they live ONCE in ~/.builders-stack/credentials.json
// keyed by provider id, and every `bsp` run across every repo reuses them. Only
// per-repo values (account ids scoped to a project, generated secrets) belong in
// a repo's .env.local instead.
//
// Layout on disk (0600, dir 0700):
//   { "version": 1, "providers": { "cloudflare": { "CLOUDFLARE_API_TOKEN": "…" }, … } }

import { homedir } from "node:os";
import { join } from "node:path";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

/** Root config dir. `BUILDERS_STACK_HOME` overrides; default ~/.builders-stack. */
export function getConfigDir(): string {
  return process.env.BUILDERS_STACK_HOME || join(homedir(), ".builders-stack");
}

function credentialsPath(): string {
  return join(getConfigDir(), "credentials.json");
}

interface Store {
  version: 1;
  providers: Record<string, Record<string, string>>;
}

const EMPTY: Store = { version: 1, providers: {} };

/** Read the store, creating an empty 0600 file (in a 0700 dir) on first use. */
function read(): Store {
  const path = credentialsPath();
  if (!existsSync(path)) return { ...EMPTY, providers: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Store>;
    return { version: 1, providers: parsed.providers ?? {} };
  } catch {
    // ponytail: corrupt/hand-edited file → treat as empty rather than crash the
    // CLI; the next set() rewrites it clean. Upgrade path: back up + warn if this
    // ever eats real creds in practice.
    return { ...EMPTY, providers: {} };
  }
}

function write(store: Store): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = credentialsPath();
  writeFileSync(path, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600); // enforce even if the file pre-existed with looser perms
}

/** All stored keys for a provider (e.g. { CLOUDFLARE_API_TOKEN: '…' }), or {}. */
export function getProviderCreds(providerId: string): Record<string, string> {
  return read().providers[providerId] ?? {};
}

/** Merge `creds` into a provider's stored root creds (upsert; other keys kept). */
export function setProviderCreds(providerId: string, creds: Record<string, string>): void {
  const store = read();
  store.providers[providerId] = { ...store.providers[providerId], ...creds };
  write(store);
}

/** Provider ids that currently have any stored root creds. */
export function listProviders(): string[] {
  return Object.keys(read().providers);
}

/**
 * Do we already hold this provider's root key(s)? Given the recipe's
 * `rootCredKeys`, returns the stored creds iff EVERY required key is present —
 * else null. This is the "reuse across repos" gate the CLI checks before it
 * prompts. No keys required → returns whatever's stored (possibly {}).
 */
export function resolveRootCreds(
  providerId: string,
  rootCredKeys: string[] = [],
): Record<string, string> | null {
  const creds = getProviderCreds(providerId);
  const haveAll = rootCredKeys.every((k) => Boolean(creds[k]));
  return haveAll ? creds : null;
}
