// ops/ci/nx-cache.ts — Nx 23's remote cache, served off a plain directory.
//
// WHY THIS FILE EXISTS. A warm self-hosted runner is the last resort for
// computation, and every run on it is meant to stay in seconds. It cannot hold
// to that after a ROOT-INPUT change (bun.lock, bunfig.toml, the root
// package.json, tsconfig.base.json, nx.json, eslint.config.mjs): those are
// `sharedGlobals`, so changing one moves EVERY task hash in the workspace and
// the runner has to lint and typecheck all of it. Upstream that measured 10-14
// minutes. The fix is to compute those answers on a dev machine and hand the
// runner the finished results, so the runner only replays them.
//
// WHY NOT A CACHE PLUGIN. Nx's four self-hosted cache plugins — @nx/s3-cache,
// @nx/shared-fs-cache, @nx/gcs-cache, @nx/azure-cache — are all published as
// `license: "Commercial"`, all depend on @nx/key, and all declare
// `peerDependencies.nx: ">= 18 < 23"`. There is no 23.x release of any of them,
// and this repo is on nx 23. `nx.json`'s old `useLegacyCache` escape hatch
// (which would have produced an rsyncable file cache) was deleted in Nx 21 —
// see node_modules/nx/dist/src/migrations/update-21-0-0/remove-legacy-cache.js,
// whose own comment says the property "is not functional in nx v21".
//
// What is left, and what nx 23 supports out of the box with no dependency at
// all, is its built-in HTTP remote cache: set
// NX_SELF_HOSTED_REMOTE_CACHE_SERVER and nx talks the protocol below from Rust
// (node_modules/nx/dist/src/tasks-runner/cache.js `getHttpCache`).
//
// THE PROTOCOL, established by running nx 23.1.1 against an instrumented server
// rather than by reading documentation:
//
//   GET  /v1/cache/<hash>   Authorization: Bearer <token>
//                           200 + application/octet-stream  -> cache hit
//                           404                             -> miss, nx runs the task
//   PUT  /v1/cache/<hash>   Authorization: Bearer <token>, body is a tar
//                           200                             -> stored
//
// THE PUT STATUS MUST BE EXACTLY 200. This is the trap in the whole design and
// nothing warns you about it. 201, 202 and 204 are all treated as a failed
// store: nx retries the PUT six times and then reports THE TASK ITSELF as
// failed, with an empty error and exit code 1 — even though the task ran fine
// and the artifact it stored carries exit code 0. A seeding run against a
// server answering 202 looks exactly like a workspace full of broken targets.
// ops/ci/fast.test.ts pins the 200.
//
// The body is an uncompressed tar holding `terminalOutput` and a 4-byte
// little-endian `code`, plus the task's declared outputs. lint and typecheck
// declare no outputs (nx.json targetDefaults), so their entries are a couple of
// hundred bytes each and a whole graph's worth is well under a megabyte.
//
// WHY A DIRECTORY AND NOT AN OBJECT STORE. The runner node already keeps a
// hostPath cache across pods (ops/deploy/k8s/actions-runner-values.yaml mounts
// it at /ci-cache), which is exactly the durable, runner-local place these
// answers belong. Serving that directory on loopback needs no bucket, no
// deploy, no public hostname and no stored credential.

import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";

// The hash becomes a filename, so it is a trust boundary even on loopback.
// Nx's hashes are decimal u64 strings; the wider class costs nothing and keeps
// this from breaking if that ever changes.
const HASH = /^[A-Za-z0-9_-]{1,128}$/;

export interface NxCacheServer {
  port: number;
  stop: () => void;
}

/**
 * Serve `directory` as an Nx remote cache on 127.0.0.1.
 *
 * Loopback-only and single-tenant: the caller starts it, hands nx the token it
 * generated, and stops it. The token is a same-process shared secret, not a
 * credential to store anywhere.
 */
export function serveNxCache(directory: string, token: string): NxCacheServer {
  mkdirSync(directory, { recursive: true });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.headers.get("authorization") !== `Bearer ${token}`) {
        return new Response("unauthorized", { status: 401 });
      }
      const hash = new URL(request.url).pathname.replace("/v1/cache/", "");
      if (!HASH.test(hash)) return new Response("not found", { status: 404 });
      const path = join(directory, hash);

      if (request.method === "GET") {
        const file = Bun.file(path);
        if (!(await file.exists())) return new Response("miss", { status: 404 });
        return new Response(file, { headers: { "content-type": "application/octet-stream" } });
      }

      if (request.method === "PUT") {
        // Write beside the entry and rename, so a reader never sees a partial
        // tar. Nx treats a truncated artifact as a hit and replays nothing.
        const temporary = `${path}.${process.pid}.partial`;
        // Buffered rather than streamed: a lint or typecheck artifact is a few
        // hundred bytes, because neither target declares outputs.
        await Bun.write(temporary, await request.arrayBuffer());
        renameSync(temporary, path);
        // Exactly 200. See the note at the top of this file.
        return new Response(null, { status: 200 });
      }

      return new Response("method not allowed", { status: 405 });
    },
  });

  if (server.port === undefined) throw new Error("the Nx cache server was given no port");
  return { port: server.port, stop: () => void server.stop(true) };
}

/**
 * Start the cache server and return the environment nx needs to use it.
 *
 * Returns an empty environment when `directory` is unset, which is how a laptop
 * running `bun ops/ci/fast.ts` by hand gets the plain local cache and no
 * surprises.
 */
export function nxCacheEnv(directory: string | undefined): {
  env: Record<string, string>;
  stop: () => void;
} {
  if (!directory) return { env: {}, stop: () => {} };
  const token = crypto.randomUUID();
  const server = serveNxCache(directory, token);
  return {
    env: {
      NX_SELF_HOSTED_REMOTE_CACHE_SERVER: `http://127.0.0.1:${server.port}`,
      NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: token,
    },
    stop: server.stop,
  };
}

// Run any command with this cache serving a directory:
//
//   bun ops/ci/nx-cache.ts /ci-cache/nx-remote -- bunx nx run @stack/api:typecheck
//
// The seeding script and CI both use the library above; this exists so the same
// behaviour can be driven by hand when checking what the cache is doing.
if (import.meta.main) {
  const separator = process.argv.indexOf("--");
  const directory = process.argv[2];
  if (!directory || separator === -1) {
    console.error("usage: bun ops/ci/nx-cache.ts <directory> -- <command...>");
    process.exit(2);
  }
  const cache = nxCacheEnv(directory);
  const child = Bun.spawn(process.argv.slice(separator + 1), {
    env: { ...process.env, ...cache.env },
    stderr: "inherit",
    stdout: "inherit",
  });
  const code = await child.exited;
  cache.stop();
  process.exit(code);
}
