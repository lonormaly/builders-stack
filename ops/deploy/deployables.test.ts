import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const registry = JSON.parse(
  readFileSync(new URL("./deployables.json", import.meta.url), "utf8"),
) as { project: string; strategy: string; entry?: string; image?: string; reason?: string }[];
const builder = readFileSync(new URL("./build-images.sh", import.meta.url), "utf8");
const skill = readFileSync(
  new URL("../../agents/skills/add-a-service/SKILL.md", import.meta.url),
  "utf8",
);
const ci = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const fastCi = readFileSync(new URL("../ci/fast.ts", import.meta.url), "utf8");
const sizeGate = readFileSync(
  new URL("../../scripts/check-image-size.ts", import.meta.url),
  "utf8",
);
const typeScriptGate = readFileSync(
  new URL("../../scripts/check-typescript.ts", import.meta.url),
  "utf8",
);
const addLibSkill = readFileSync(
  new URL("../../agents/skills/add-a-lib/SKILL.md", import.meta.url),
  "utf8",
);
describe("deployment contract", () => {
  test("every Bun service uses the shared small image builder", () => {
    const services = registry.filter((item) => item.strategy === "k3s-bun-bundle");
    expect(services.map((item) => item.project)).toEqual([
      "@stack/api",
      "@stack/ai-worker",
      "@stack/payment",
    ]);
    expect(services.every((item) => item.entry && item.image)).toBe(true);
    expect(builder).toContain("infra/bundled-bun-service.Dockerfile");
    expect(builder).toContain("scripts/check-image-size.ts");
    expect(builder.indexOf("scripts/check-image-size.ts")).toBeLessThan(
      builder.indexOf("docker push"),
    );
    expect(sizeGate).toContain("const LIMIT_MB = 300");
  });
  // The install is skipped ONLY on a fingerprint of everything that decides what
  // gets installed — never on node_modules merely existing. A warm runner that
  // trusts an existing tree runs the next job against the previous PR's
  // dependencies and every result it produces is a lie.
  test("the dependency setup is the only warm-install authority", () => {
    expect(ci).toContain('fingerprint="$(bun --version; cksum bun.lock bunfig.toml)"');
    expect(ci).toContain("node_modules/.stack-install");
    expect(ci).toContain("bun install --frozen-lockfile --ignore-scripts");
    expect(ci).toContain("printf '%s\\n' \"$fingerprint\" > node_modules/.stack-install");
  });
  test("future services must register a deployment decision", () => {
    expect(skill).toContain("ops/deploy/deployables.json");
    expect(skill).toContain("check:deployables");
    expect(
      registry.filter((item) => item.strategy === "not-deployed").every((item) => item.reason),
    ).toBe(true);
  });
  test("future workspaces inherit stable TypeScript 7", () => {
    expect(typeScriptGate).toContain("Stable TypeScript 7 checks every workspace");
    expect(skill).toContain("scripts/typecheck-native.sh");
    expect(addLibSkill).toContain("scripts/typecheck-native.sh");
    expect(ci).toContain("ops/ci/fast.ts");
    expect(fastCi).toContain("check:typescript");
  });
});
