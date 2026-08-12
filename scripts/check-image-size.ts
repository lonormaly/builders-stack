#!/usr/bin/env bun
const LIMIT_MB = 300;
const registry = (await Bun.file(
  new URL("../ops/deploy/deployables.json", import.meta.url),
).json()) as { strategy: string; image?: string }[];
const images = registry
  .filter((item) => item.strategy === "k3s-bun-bundle" && item.image)
  .map((item) => item.image!);
const tag = process.argv.slice(2).find((arg) => !arg.startsWith("-")) ?? "";
async function sizeMb(ref: string): Promise<number | null> {
  const child = Bun.spawn(["docker", "images", ref, "--format", "{{.Size}}"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = (await new Response(child.stdout).text()).trim().split("\n")[0] ?? "";
  const match = /^([\d.]+)\s*([KMG]B)$/i.exec(output);
  if (!match) return null;
  const number = Number(match[1]);
  return match[2]!.toUpperCase() === "GB"
    ? number * 1024
    : match[2]!.toUpperCase() === "KB"
      ? number / 1024
      : number;
}
let failed = false;
for (const image of images) {
  const ref = tag ? `${image}:${tag}` : image;
  const mb = await sizeMb(ref);
  if (mb === null) {
    console.log(`${ref}: not built locally`);
    continue;
  }
  console.log(`${ref}: ${mb.toFixed(0)} MB`);
  if (mb > LIMIT_MB) failed = true;
}
if (failed) {
  console.error(`Production images must be ${LIMIT_MB} MB or smaller.`);
  process.exit(1);
}
console.log(`Every built production image is ${LIMIT_MB} MB or smaller.`);
