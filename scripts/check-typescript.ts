#!/usr/bin/env bun

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const BUCKETS = ["apps", "services", "libs", "packages"];
const STABLE_CHECKER = "bash ../../scripts/typecheck-native.sh";
const failures: string[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

for (const bucket of BUCKETS) {
  const entries = await readdir(resolve(ROOT, bucket), { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relativePath = `${bucket}/${entry.name}/package.json`;
    const packageJson: unknown = JSON.parse(await readFile(resolve(ROOT, relativePath), "utf8"));
    const scripts =
      isRecord(packageJson) && isRecord(packageJson.scripts) ? packageJson.scripts : {};
    const devDependencies =
      isRecord(packageJson) && isRecord(packageJson.devDependencies)
        ? packageJson.devDependencies
        : {};
    const command = typeof scripts.typecheck === "string" ? scripts.typecheck : undefined;
    if (!command?.includes(STABLE_CHECKER)) {
      failures.push(`${relativePath}: typecheck must call ${STABLE_CHECKER}`);
    }
    if (typeof devDependencies["@typescript/native-preview"] === "string") {
      failures.push(`${relativePath}: remove @typescript/native-preview`);
    }
  }
}

if (failures.length) {
  console.error("Stable TypeScript 7 is not wired through the shared checker:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Stable TypeScript 7 checks every workspace");
