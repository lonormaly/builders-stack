// Self-check for the manifest parser + idempotent upsert (the load-bearing
// parsers) and the config-store's cross-repo reuse gate. `bun test`.
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnvExample, upsertEnvLocal } from "./env-file";
import { resolveRootCreds, setProviderCreds, getConfigDir } from "./config-store";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "bsp-"));
}

test("parseEnvExample reads keys, inline comments, and optional (commented) vars", () => {
  const dir = tmp();
  const p = join(dir, ".env.example");
  writeFileSync(
    p,
    [
      "# prose line, ignored",
      "DATABASE_URL=postgres://x   # the db",
      "AI_API_KEY=                               # OpenAI key (sk-…)",
      "# CREEM_API_KEY=",
      "",
    ].join("\n"),
  );
  const vars = parseEnvExample(p);
  expect(vars.map((v) => v.key)).toEqual(["DATABASE_URL", "AI_API_KEY", "CREEM_API_KEY"]);
  expect(vars[0]!.comment).toBe("the db");
  expect(vars[1]!.comment).toBe("OpenAI key (sk-…)");
  expect(vars[2]!.optional).toBe(true);
});

test("upsertEnvLocal is idempotent and never clobbers unrelated vars", () => {
  const dir = tmp();
  const p = join(dir, ".env.local");
  writeFileSync(p, ["# my own note", "MY_MANUAL_VAR=keep-me", "AI_API_KEY=old", ""].join("\n"));

  const first = upsertEnvLocal(p, { AI_API_KEY: "sk-new", RESEND_API_KEY: "re_1" });
  expect(first.written.sort()).toEqual(["AI_API_KEY", "RESEND_API_KEY"]);
  const after = readFileSync(p, "utf8");
  expect(after).toContain("MY_MANUAL_VAR=keep-me"); // untouched
  expect(after).toContain("# my own note"); // untouched
  expect(after).toContain("AI_API_KEY=sk-new"); // replaced in place
  expect(after).toContain("RESEND_API_KEY=re_1"); // appended

  // second run, same values → nothing written
  const second = upsertEnvLocal(p, { AI_API_KEY: "sk-new", RESEND_API_KEY: "re_1" });
  expect(second.written).toEqual([]);
  expect(second.unchanged.sort()).toEqual(["AI_API_KEY", "RESEND_API_KEY"]);
});

test("resolveRootCreds gates cross-repo reuse on ALL required keys present", () => {
  const home = tmp();
  process.env.BUILDERS_STACK_HOME = home;
  expect(getConfigDir()).toBe(home);

  expect(resolveRootCreds("cloudflare", ["CLOUDFLARE_API_TOKEN"])).toBeNull();
  setProviderCreds("cloudflare", { CLOUDFLARE_API_TOKEN: "tok" });
  expect(resolveRootCreds("cloudflare", ["CLOUDFLARE_API_TOKEN"])).toEqual({
    CLOUDFLARE_API_TOKEN: "tok",
  });
  // a second required key that isn't stored → gate closes again
  expect(
    resolveRootCreds("cloudflare", ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]),
  ).toBeNull();
});
