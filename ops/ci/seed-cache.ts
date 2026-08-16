#!/usr/bin/env bun
// ops/ci/seed-cache.ts — compute CI's answers here, so the runner never has to.
//
//   bun ops/ci/seed-cache.ts            # seed the answers for origin/main
//   bun ops/ci/seed-cache.ts <ref>      # seed the answers for any ref
//   bun ops/ci/seed-cache.ts --dry-run  # compute and report, upload nothing
//
// WHAT IT IS FOR. The self-hosted runner is the last resort for computation
// here. It holds its seconds-long budget on an ordinary change because `nx
// affected` only touches what moved. It cannot hold it after a ROOT-INPUT
// change — bun.lock, bunfig.toml, the root package.json, tsconfig.base.json,
// nx.json, eslint.config.mjs — because those are `sharedGlobals` inputs, so
// changing one changes EVERY task hash in the workspace and the runner has to
// lint and typecheck all of it. Upstream that measured 10-14 minutes.
//
// So this runs that whole graph on a dev machine, where the CPUs are idle and
// nobody is waiting, and leaves the finished answers where the runner can read
// them. The runner then replays them.
//
// LINT AND TYPECHECK ONLY, AND TESTS ARE NEVER SEEDED. A type error and a lint
// violation are properties of the source and do not vary by platform; a passing
// TEST does. A dev machine is usually macOS/arm64 and the runner is Linux/x64, so
// a green test here says nothing about whether it is green there. Tests keep
// executing on the runner every time. The runner is still free to store its OWN
// test results — those were computed on Linux and are valid for Linux.
//
// A FAILING GRAPH IS NEVER UPLOADED. Nx caches failures as readily as successes
// (the artifact carries the exit code), and a flaky local failure that reached
// the shared directory would be replayed as a red CI run on every machine until
// somebody deleted it by hand. So the answers are staged locally first and only
// leave this machine if the whole run was green.
//
// ── FILL THESE IN ────────────────────────────────────────────────────────────
// STACK_SEED_SSH   ssh target that owns the runner's cache directory, e.g.
//                  root@203.0.113.10. Unset: discovered from the Kubernetes node
//                  labelled `stack.io/ci-cache=true` (see ops/deploy/install-arc.sh).
// KUBECTL_CONTEXT  kube context to ask. Default: `stack`.
// HOST_CACHE_DIR   below — the path the runner mounts at /ci-cache.

import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveNxCache } from "./nx-cache";

// The runner's node-local cache directory. Same directory
// ops/deploy/k8s/actions-runner-values.yaml mounts at /ci-cache, one level down.
const HOST_CACHE_DIR = "/var/lib/stack-ci-cache/nx-remote";
const NODE_LABEL = "stack.io/ci-cache=true";
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? "stack";
// Entries older than this are dropped on each seed. They are a few hundred
// bytes each, so this is about keeping the directory readable rather than about
// disk; anything pruned that is still wanted is simply recomputed once.
const KEEP_DAYS = 14;

/**
 * Run a command without blocking this process.
 *
 * NOTHING HERE MAY USE `spawnSync`, AND THE REASON IS EXPENSIVE. The Nx cache
 * server started below runs inside THIS process, on Bun's event loop. A
 * synchronous child blocks that loop, so the server stops answering — and what
 * that looks like is not an error. Nx finishes a task, opens its store request,
 * and waits on a socket nobody is listening to; the whole run crawls to a halt
 * with no message. Measured upstream: one task completed in seventeen minutes
 * and the staged answers directory stayed empty the entire time.
 */
async function run(
  command: string[],
  options: { cwd?: string; env?: Record<string, string>; quiet?: boolean } = {},
): Promise<{ status: number; stdout: string }> {
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stderr: options.quiet ? "pipe" : "inherit",
    stdout: options.quiet ? "pipe" : "inherit",
  });
  const stdout = options.quiet ? await new Response(child.stdout).text() : "";
  return { status: await child.exited, stdout };
}

/**
 * The ssh target that owns the runner's caches.
 *
 * Read from the cluster rather than written down, because the cluster already
 * holds the answer: install-arc.sh refuses to install unless exactly one node
 * carries the cache label, and the runner's nodeSelector pins every ephemeral
 * pod to that same node. Move the label and this follows it. Set
 * STACK_SEED_SSH to skip the lookup entirely (no cluster, or a plain VM runner).
 */
async function cacheTarget(): Promise<string> {
  const configured = process.env.STACK_SEED_SSH;
  if (configured) return configured;
  const { status, stdout } = await run(
    [
      "kubectl",
      "--context",
      KUBECTL_CONTEXT,
      "get",
      "nodes",
      "-l",
      NODE_LABEL,
      "-o",
      // ExternalIP, not InternalIP. The node's InternalIP is a private cluster
      // address a laptop cannot reach; the ExternalIP is the one ssh answers on.
      "jsonpath={.items[*].status.addresses[?(@.type=='ExternalIP')].address}",
    ],
    { quiet: true },
  );
  const addresses = stdout.trim().split(/\s+/).filter(Boolean);
  if (status !== 0 || addresses.length !== 1) {
    throw new Error(
      `expected exactly one node labelled ${NODE_LABEL}, found ${addresses.length || "none"}. ` +
        `Point KUBECONFIG at the cluster, or set STACK_SEED_SSH=user@host.`,
    );
  }
  return `root@${addresses[0]}`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const ref = argv.find((argument) => !argument.startsWith("--")) ?? "origin/main";

  // Resolve the ref before anything else, so the report names a commit rather
  // than a moving branch and a stale `origin/main` is caught here.
  const resolved = await run(["git", "rev-parse", "--verify", `${ref}^{commit}`], { quiet: true });
  if (resolved.status !== 0) throw new Error(`cannot resolve ref: ${ref}`);
  const commit = resolved.stdout.trim();

  // A CLEAN CHECKOUT, NOT THIS ONE. Nx hashes the files it finds on disk, so
  // seeding from a working tree with uncommitted edits produces answers under
  // hashes CI will never ask for — every one a silent miss. This is a detached
  // worktree holding exactly what the runner checks out.
  //
  // It is kept between runs rather than made fresh each time: `bun install` on a
  // warm tree is a second, and building it from nothing is gigabytes and a minute.
  const checkout = process.env.STACK_SEED_CHECKOUT ?? join(tmpdir(), "stack-seed-checkout");
  const staging = mkdtempSync(join(tmpdir(), "stack-seed-answers-"));
  console.error(`seeding ${ref} (${commit.slice(0, 8)})`);
  console.error(`  checkout: ${checkout}`);

  let seeded = 0;
  try {
    if (!existsSync(join(checkout, ".git"))) {
      rmSync(checkout, { force: true, recursive: true });
      if (
        (await run(["git", "worktree", "add", "--detach", "--force", checkout, commit])).status !==
        0
      ) {
        throw new Error("could not create the seeding worktree");
      }
    } else {
      // The same reset CI performs, and for the same reason: only tracked source
      // may differ between runs, and node_modules is expensive to rebuild.
      await run(["git", "-C", checkout, "checkout", "--detach", "--force", commit], {
        quiet: true,
      });
      await run(["git", "-C", checkout, "clean", "-ffdx", "-e", "node_modules/", "-e", ".nx/"], {
        quiet: true,
      });
    }
    if (
      (await run(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], { cwd: checkout }))
        .status !== 0
    ) {
      throw new Error("bun install failed in the seeding worktree");
    }

    const token = crypto.randomUUID();
    const server = serveNxCache(staging, token);
    // A FRESH NX CACHE FOR EVERY SEED, and this is not tidiness.
    //
    // Nx only stores to the remote cache after it has actually RUN a task. A
    // local hit returns before the remote is ever consulted, so seeding against
    // a warm cache uploads nothing at all and reports success while doing it.
    // Pointing Nx at an empty cache is what makes it recompute the graph and
    // hand over every answer — which is the entire job of this script.
    //
    // It also keeps the seed out of your own cache: this checkout is a linked
    // worktree, and Nx 23 otherwise redirects both directories to the MAIN
    // worktree's .nx (see nx/src/utils/cache-directory.js).
    const nxState = join(staging, "..", `nx-state-${process.pid}`);
    try {
      const status = (
        await run(
          [
            "bunx",
            "nx",
            "run-many",
            "-t",
            // Never `test`. See the note at the top of this file.
            "lint,typecheck",
            "--all",
            "--output-style=static",
          ],
          {
            cwd: checkout,
            env: {
              NX_CACHE_DIRECTORY: join(nxState, "cache"),
              NX_DAEMON: "false",
              NX_SELF_HOSTED_REMOTE_CACHE_SERVER: `http://127.0.0.1:${server.port}`,
              NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: token,
              NX_WORKSPACE_DATA_DIRECTORY: join(nxState, "workspace-data"),
            },
          },
        )
      ).status;
      if (status !== 0) {
        throw new Error(
          "the graph is not green on this machine — nothing was uploaded. " +
            "Fix the failing targets (or re-run: a flaky failure is cached too) and seed again.",
        );
      }
    } finally {
      server.stop();
    }

    seeded = readdirSync(staging).length;
    if (seeded === 0) throw new Error("no answers were produced — refusing to report success");
    console.error(`  computed ${seeded} answers`);

    if (dryRun) {
      console.error(`  --dry-run: left in ${staging}`);
      return;
    }

    const target = await cacheTarget();
    console.error(`  uploading to ${target}:${HOST_CACHE_DIR}`);
    // tar over ssh rather than rsync: it assumes nothing about what is installed
    // on either end, and the whole payload is a few hundred kilobytes because
    // lint and typecheck declare no outputs.
    const upload = await run([
      "bash",
      "-c",
      // COPYFILE_DISABLE: macOS tar otherwise ships an AppleDouble `._<hash>`
      // beside every entry, which lands in the runner's cache directory as
      // permanent litter nothing will ever ask for.
      `COPYFILE_DISABLE=1 tar -C ${JSON.stringify(staging)} -cf - . | ` +
        `ssh -o BatchMode=yes ${target} ` +
        `'mkdir -p ${HOST_CACHE_DIR} && tar -C ${HOST_CACHE_DIR} -xf - && ` +
        `find ${HOST_CACHE_DIR} -type f -mtime +${KEEP_DAYS} -delete && ` +
        `chown -R 1001:1001 ${HOST_CACHE_DIR}'`,
    ]);
    if (upload.status !== 0) throw new Error("upload failed");
    console.error(`seeded ${seeded} answers for ${commit.slice(0, 8)}`);
  } finally {
    // The checkout is deliberately kept; the answers and Nx's scratch state for
    // this run are not.
    rmSync(staging, { force: true, recursive: true });
    rmSync(join(staging, "..", `nx-state-${process.pid}`), { force: true, recursive: true });
  }
}

if (import.meta.main) await main();
