import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Deployable = {
  project: string;
  unit?: string;
  strategy: string;
  build?: string;
  owner?: string;
  entry?: string;
  image?: string;
  reason?: string;
};
const root = join(import.meta.dirname, "..");
const registry = (await Bun.file(join(root, "ops/deploy/deployables.json")).json()) as Deployable[];
const errors: string[] = [];
const workspaceProjects = new Set<string>();
for (const bucket of ["apps", "services"]) {
  for (const directory of readdirSync(join(root, bucket), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const manifest = join(root, bucket, directory.name, "package.json");
    if (!existsSync(manifest)) continue;
    const json = (await Bun.file(manifest).json()) as { name?: string };
    if (!json.name) errors.push(`${manifest} has no package name`);
    else workspaceProjects.add(json.name);
  }
}
const seenProjects = new Set<string>();
const seenUnits = new Set<string>();
const strategies = new Set(["app-build", "k3s-bun-bundle", "not-deployed"]);
for (const item of registry) {
  if (seenProjects.has(item.project)) errors.push(`${item.project} appears more than once`);
  seenProjects.add(item.project);
  if (!workspaceProjects.has(item.project)) errors.push(`${item.project} has no app or service`);
  if (!strategies.has(item.strategy))
    errors.push(`${item.project} has unknown strategy ${item.strategy}`);
  if (item.strategy === "not-deployed") {
    if (!item.reason) errors.push(`${item.project} must explain why it is not deployed`);
    if (item.unit || item.owner || item.build)
      errors.push(`${item.project} is not deployed and must not declare a release unit`);
    continue;
  }
  if (!item.unit) errors.push(`${item.project} has no deployment unit`);
  else if (seenUnits.has(item.unit))
    errors.push(`deployment unit ${item.unit} appears more than once`);
  else seenUnits.add(item.unit);
  if (!item.build) errors.push(`${item.project} has no build contract`);
  if (!item.owner || !existsSync(join(root, item.owner)))
    errors.push(`${item.project} has no valid deployment owner`);
  if (item.strategy === "k3s-bun-bundle") {
    if (!item.entry || !existsSync(join(root, item.entry)))
      errors.push(`${item.project} has no valid entry`);
    if (!item.image) errors.push(`${item.project} has no image name`);
    if (item.owner !== "ops/deploy/build-images.sh")
      errors.push(`${item.project} must use the shared Bun image builder`);
  }
}
for (const project of workspaceProjects)
  if (!seenProjects.has(project)) errors.push(`${project} has no deployment decision`);
if (errors.length) {
  console.error("check:deployables failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`${registry.length} apps and services have one deployment decision`);
