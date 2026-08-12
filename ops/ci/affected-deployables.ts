#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error("usage: bun ops/ci/affected-deployables.ts BASE HEAD");
  process.exit(2);
}
const nx = spawnSync(
  "bunx",
  ["nx", "show", "projects", "--affected", `--base=${base}`, `--head=${head}`, "--json"],
  { encoding: "utf8" },
);
if (nx.status !== 0) {
  process.stderr.write(nx.stderr);
  process.exit(nx.status ?? 1);
}
const affected = new Set(JSON.parse(nx.stdout) as string[]);
const registry = (await Bun.file(
  join(import.meta.dirname, "../deploy/deployables.json"),
).json()) as { project: string; unit?: string; strategy: string }[];
const selected = registry.filter(
  (item) => item.strategy !== "not-deployed" && item.unit && affected.has(item.project),
);
const deployables = {
  base,
  head,
  apps: selected.filter((item) => item.strategy === "app-build").map((item) => item.unit),
  services: selected.filter((item) => item.strategy === "k3s-bun-bundle").map((item) => item.unit),
};
const result = JSON.stringify(deployables);
console.log(result);
if (process.env.STACK_DEPLOYABLES_FILE)
  await Bun.write(process.env.STACK_DEPLOYABLES_FILE, `${JSON.stringify(deployables, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT)
  await Bun.write(process.env.GITHUB_OUTPUT, `deployables=${result}\n`);
