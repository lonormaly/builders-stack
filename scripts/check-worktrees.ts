import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const failures: string[] = [];
const wt0Launcher = read("ops/dev/wt0.sh");

function requireText(path: string, pattern: RegExp, message: string) {
  if (!pattern.test(read(path))) failures.push(`${path}: ${message}`);
}

requireText("package.json", /"packageManager": "bun@1\.3\.14"/, "pin Bun 1.3.14");
requireText(
  "package.json",
  /"typescript": "\^6\.0\.3"/,
  "declare the TypeScript runtime Nx needs under the isolated linker",
);
requireText(
  "package.json",
  /"@types\/node": "\^26\.1\.0"/,
  "declare the Node types required by the shared root tsconfig",
);
if (/"typescript-7"/.test(read("package.json"))) {
  failures.push(
    "package.json: a typescript-7 alias shadows Nx's TypeScript 6 runtime under Bun's isolated linker",
  );
}
requireText(".tool-versions", /^bun 1\.3\.14$/m, "match the Bun packageManager pin");
requireText(".wt0-version", /^\d+\.\d+\.\d+$/m, "pin one stable Worktree Zero semantic version");
requireText("bunfig.toml", /^linker = "isolated"$/m, "use Bun's isolated linker");
requireText("bunfig.toml", /^globalStore = true$/m, "enable Bun's global virtual store");
requireText(".github/workflows/ci.yml", /bun-version: 1\.3\.14/, "run the pinned Bun in CI");
requireText("AGENTS.md", /ops\/dev\/worktree\.sh <branch>/, "require the managed worktree wrapper");
requireText("CLAUDE.md", /ops\/dev\/worktree\.sh <branch>/, "mirror the managed worktree rule");
requireText(
  "ops/dev/worktree.sh",
  /WT0_BIN="\$\{WORKTREE_ZERO_BIN:-\$ROOT\/ops\/dev\/wt0\.sh\}"/,
  "use the checksum-verified Worktree Zero launcher by default",
);
requireText(
  "ops/dev/wt0.sh",
  /\.wt0-version/,
  "read the pinned Worktree Zero version from one source",
);
requireText("ops/dev/wt0.sh", /\.sha256/, "verify the release checksum before execution");
requireText("ops/dev/wt0.sh", /--version/, "verify the downloaded binary version");
requireText("ops/dev/worktree.sh", /"\$WT0_BIN" create/, "create source through Worktree Zero");
requireText(
  "ops/dev/worktree.sh",
  /"\$WT0_BIN" prepare "\$DIR" --apply/,
  "prepare the package-manager environment through Worktree Zero",
);
requireText("ops/dev/worktree.sh", /--require-cow/, "refuse a silent full-copy worktree fallback");
requireText("ops/dev/worktree.sh", /"\$WT0_BIN" doctor/, "verify runtime through Worktree Zero");
requireText("ops/dev/worktree.sh", /"\$WT0_BIN" remove/, "remove through Worktree Zero");
requireText(
  "ops/dev/worktree.sh",
  /git -C "\$ROOT" cherry "\$BASE_REF"/,
  "prove patch equivalence before removal",
);

if ((statSync(resolve(root, "ops/dev/worktree.sh")).mode & 0o111) === 0) {
  failures.push("ops/dev/worktree.sh: must be executable");
}
if ((statSync(resolve(root, "ops/dev/wt0.sh")).mode & 0o111) === 0) {
  failures.push("ops/dev/wt0.sh: must be executable");
}
if (!/curl --fail --location[^\n]+--proto '=https' --tlsv1\.2/.test(wt0Launcher)) {
  failures.push("ops/dev/wt0.sh: release download must require verified HTTPS");
}
if (/worktree remove --force/.test(read("ops/dev/worktree.sh"))) {
  failures.push("ops/dev/worktree.sh: forced removal is forbidden");
}
if (/git -C "\$ROOT" worktree (add|remove)/.test(read("ops/dev/worktree.sh"))) {
  failures.push("ops/dev/worktree.sh: raw Git lifecycle must stay behind Worktree Zero");
}

if (failures.length > 0) {
  console.error(`Worktree lifecycle check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Worktree lifecycle is pinned, shared, bounded, and safe to remove.");
