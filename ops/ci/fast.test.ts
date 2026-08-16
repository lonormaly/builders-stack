import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planFastChecks } from "./fast";
import { serveNxCache } from "./nx-cache";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("fast CI input planning", () => {
  test("a docs-only change builds no graph and runs no gate", () => {
    const plan = planFastChecks(["docs/stack/ci-performance.md", "README.md"]);
    expect(plan.runNx).toBe(false);
    expect(plan.checks).toEqual([]);
    expect(plan.boundaryFiles).toEqual([]);
    // Prose is still formatted.
    expect(plan.formatFiles).toEqual(["docs/stack/ci-performance.md", "README.md"]);
  });

  test("a service source change uses the dependency graph and no unrelated gate", () => {
    const plan = planFastChecks(["services/api/src/index.ts"]);
    expect(plan.runNx).toBe(true);
    expect(plan.boundaryFiles).toEqual(["services/api/src/index.ts"]);
    expect(plan.checks).toEqual([]);
  });

  test("a public page runs the SEO gate", () => {
    const plan = planFastChecks(["apps/web/app/page.tsx"]);
    expect(plan.runNx).toBe(true);
    expect(plan.checks).toContain("check:seo");
  });

  test("a new service manifest runs the registry and TypeScript gates", () => {
    const plan = planFastChecks(["services/notifier/package.json"]);
    expect(plan.checks).toEqual(expect.arrayContaining(["check:deployables", "check:typescript"]));
  });

  test("the worktree tooling runs its own gate and nothing else", () => {
    const plan = planFastChecks(["ops/dev/worktree.sh"]);
    expect(plan.runNx).toBe(false);
    expect(plan.checks).toEqual(["check:worktrees"]);
  });

  test("a root graph input conservatively runs every declared gate", () => {
    for (const input of ["bun.lock", "bunfig.toml", "nx.json", "tsconfig.base.json", ".nxignore"]) {
      const plan = planFastChecks([input]);
      expect(plan.runNx).toBe(true);
      expect(new Set(plan.checks)).toEqual(
        new Set(["check:seo", "check:deployables", "check:typescript", "check:worktrees"]),
      );
    }
  });

  test("only workspace code is boundary-linted", () => {
    const plan = planFastChecks(["scripts/check-seo.ts", "libs/ui/src/button.tsx"]);
    expect(plan.lintFiles).toContain("scripts/check-seo.ts");
    expect(plan.boundaryFiles).toEqual(["libs/ui/src/button.tsx"]);
  });

  // nx.json's sharedGlobals are an input to EVERY task. A file listed there and
  // missing from the planner's GRAPH_INPUTS makes the planner under-run: it
  // would skip gates on a change that actually invalidated the whole workspace.
  test("every nx sharedGlobal is treated as a root graph input", () => {
    const nx = JSON.parse(read("../../nx.json")) as {
      namedInputs: { sharedGlobals: string[] };
    };
    const planner = read("./fast.ts");
    for (const entry of nx.namedInputs.sharedGlobals) {
      const path = entry.replace("{workspaceRoot}/", "");
      expect(planner).toContain(`"${path}"`);
    }
  });
});

// The seeded cache is the only reason a root-input change can finish inside the
// runner's budget, and two things about it are easy to break silently: the status
// code nx demands on a store, and the promise that a dev machine never answers
// for a Linux test run.
describe("seeded Nx cache", () => {
  const seed = read("./seed-cache.ts");
  const fastRunner = read("./fast.ts");

  test("stores an answer and gives it back", async () => {
    const directory = mkdtempSync(join(tmpdir(), "nx-cache-test-"));
    const token = "test-token";
    const server = serveNxCache(directory, token);
    const url = `http://127.0.0.1:${server.port}/v1/cache/12345678901234567890`;
    const auth = { authorization: `Bearer ${token}` };
    try {
      expect((await fetch(url, { headers: auth })).status).toBe(404);

      const stored = await fetch(url, { body: "an-answer", headers: auth, method: "PUT" });
      // EXACTLY 200. Nx 23 treats 201, 202 and 204 as a failed store: it retries
      // six times and then reports THE TASK as failed, with no error text and an
      // artifact that carries exit code 0. Measured against nx 23.1.1.
      expect(stored.status).toBe(200);

      const hit = await fetch(url, { headers: auth });
      expect(hit.status).toBe(200);
      expect(await hit.text()).toBe("an-answer");
    } finally {
      server.stop();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test("refuses a request without the token, and a hash that is not one", async () => {
    const directory = mkdtempSync(join(tmpdir(), "nx-cache-test-"));
    const server = serveNxCache(directory, "test-token");
    try {
      const base = `http://127.0.0.1:${server.port}/v1/cache`;
      expect((await fetch(`${base}/123`)).status).toBe(401);
      // The hash becomes a filename, so traversal is refused before any read.
      const traversal = await fetch(`${base}/..%2F..%2Fetc%2Fpasswd`, {
        headers: { authorization: "Bearer test-token" },
      });
      expect(traversal.status).toBe(404);
    } finally {
      server.stop();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test("seeding never answers for a test, and never uploads a red graph", () => {
    // A dev machine answering "the tests passed" for a Linux runner is the one
    // thing this must never do.
    expect(seed).toContain('"lint,typecheck"');
    expect(seed).not.toMatch(/"lint,typecheck,test"|-t",\s*"test"/);
    // Nx caches a failure as readily as a success. A red graph that reached the
    // shared directory would be replayed as a red CI run on every machine.
    expect(seed).toContain("the graph is not green on this machine");
  });

  // The cache server runs on the same event loop as the process that starts it,
  // so ONE synchronous child anywhere after it starts freezes it — and Nx's
  // reaction is to hang on a store with no error, not to fail. Seventeen minutes
  // produced one completed task and an empty answers directory before this was
  // found upstream.
  test("nothing blocks the event loop while the cache server is serving", () => {
    expect(seed).not.toMatch(/\bspawnSync\(/);
    const afterServerStarts = fastRunner.slice(fastRunner.indexOf("const cache = nxCacheEnv("));
    expect(afterServerStarts).not.toMatch(/\bspawnSync\(/);
  });

  test("the warm runner serves the seeded answers, and a hosted runner gets none", () => {
    expect(fastRunner).toContain("nxCacheEnv");
    // Off unless the runner's own persistent cache mount is present, so a
    // hand-run and every GitHub-hosted run use the plain local Nx cache.
    expect(fastRunner).toContain("process.env.STACK_CI_CACHE_ROOT");
  });
});

// These pin the properties that make a warm run fast and a bad run survivable.
// Each one is here because losing it produced a real outage or a silent
// slowdown, not because it reads well.
describe("runner speed contract", () => {
  const workflow = read("../../.github/workflows/ci.yml");
  const runnerValues = read("../../ops/deploy/k8s/actions-runner-values.yaml");
  const runnerInstall = read("../../ops/deploy/install-arc.sh");
  const packageJson = JSON.parse(read("../../package.json")) as { packageManager: string };
  const bunVersion = packageJson.packageManager.replace("bun@", "");

  test("the commit gate keeps its warm state and plans its own work", () => {
    expect(workflow).toContain("-e node_modules/ -e .nx/");
    expect(workflow).toContain("node_modules/.stack-install");
    expect(workflow).toContain('bun ops/ci/fast.ts "$NX_BASE" "$NX_HEAD"');
    expect(workflow).toContain("STACK_CI_CACHE_ROOT");
  });

  // A killed install leaves a node_modules that breaks Bun's linker on every
  // LATER install. Without the retry, one interrupted job wedges a warm runner
  // permanently and every following job fails identically.
  test("a corrupt dependency tree repairs itself instead of wedging the runner", () => {
    expect(workflow).toContain("find . -name node_modules -type d -prune -exec rm -rf {} +");
  });

  // A root-input change legitimately rebuilds the whole graph. A 5-minute
  // ceiling killed it mid-rebuild twice, so the next run started cold as well.
  test("the ceiling bounds a hung job without racing a legitimate rebuild", () => {
    expect(workflow).toMatch(/timeout-minutes: (1[5-9]|[2-9]\d)/);
  });

  test("Bun is pinned to one version everywhere it is installed", () => {
    expect(workflow).toContain(`bun-version: ${bunVersion}`);
    expect(runnerValues).toContain(`image: oven/bun:${bunVersion}`);
    expect(runnerValues).toContain(`test "$(/usr/local/bin/bun --version)" = "${bunVersion}"`);
  });

  test("the idle runner has node and a bounded warm-up before it takes a job", () => {
    // The runner image ships an alpine node under externals too, and it cannot
    // run on this glibc image. eslint launches through `/usr/bin/env node`.
    expect(runnerValues).toContain("grep -v alpine");
    // An unbounded wait here once looped forever on a dangling .bin/nx: the
    // runner never registered, and no job could run the install that would
    // repair it. A cold slow job beats a dead queue.
    expect(runnerValues).toContain('[ "$waited" -ge 120 ]');
  });

  // 3Gi (3072Mi) fits the warm incremental gate and then OOMKills the first
  // full-graph run — GitHub reports that as "runner lost communication", not as
  // an OOM, and it wedged the upstream queue for hours. That number is the
  // measured floor, so the limit must clear it with room.
  //
  // It is deliberately NOT `heap x parallel` (here 3 x 2048 = 6144Mi): Node's
  // --max-old-space-size is a per-process CEILING, not a reservation, and three
  // checkers do not peak together. Sizing to the product would make the pod
  // unschedulable on a small node, which is a worse failure than a slow job.
  // If you raise --parallel or the heap, re-measure a full-graph run.
  test("the runner's memory limit clears the value that OOMKilled it", () => {
    const heapMb = Number(/--max-old-space-size=(\d+)/.exec(workflow)?.[1]);
    const parallel = Number(/--parallel=(\d+)/.exec(read("./fast.ts"))?.[1]);
    expect(heapMb).toBeGreaterThan(0);
    expect(parallel).toBeGreaterThan(0);
    // The biggest declared limit is the runner container's; the init containers
    // are sized in tens of mebibytes.
    const limitMb = Math.max(
      ...[...runnerValues.matchAll(/limits: \{[^}]*memory: (\d+)Mi/g)].map((m) => Number(m[1])),
    );
    expect(limitMb).toBeGreaterThan(3072);
    expect(limitMb).toBeGreaterThanOrEqual(heapMb * 2);
  });

  test("every ephemeral runner returns to the node that owns its caches", () => {
    expect(runnerValues).toContain('stack.io/ci-cache: "true"');
    expect(runnerInstall).toContain("Exactly one node must have stack.io/ci-cache=true");
  });
});
