// .env manifest reader + idempotent .env.local writer.
//
// .env.example is the VAR MANIFEST: it names every var the repo understands and
// carries an inline `# comment` describing each. We parse it to drive the flow
// (which vars exist, what they're for). We NEVER read secrets from it — it ships
// blank.
//
// Writing goes to .env.local (gitignored). The upsert is line-preserving: it
// rewrites the line for a var we own and leaves every other line — comments,
// blank lines, unrelated vars a human set by hand — exactly as it was. Running
// the CLI twice is a no-op on unchanged values.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface EnvVar {
  key: string;
  /** The inline `# …` comment on the var's line in .env.example, if any. */
  comment?: string;
  /** True if the var was commented-out (`# FOO=`) in the manifest — optional/opt-in. */
  optional: boolean;
}

// KEY=value, optionally preceded by `# ` (commented-out/optional var) and
// optionally trailed by an inline ` # comment`. Value is ignored (manifest is blank).
const LINE = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/;

/** Parse .env.example into the ordered var manifest. */
export function parseEnvExample(path: string): EnvVar[] {
  if (!existsSync(path)) return [];
  const out: EnvVar[] = [];
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const m = LINE.exec(raw);
    if (!m) continue; // pure comment / prose / blank line
    const [, commentedOut, key, rest] = m;
    out.push({
      key: key!,
      comment: extractInlineComment(rest!),
      optional: Boolean(commentedOut),
    });
  }
  return out;
}

/** Pull the ` # trailing comment` off a value, honoring quotes. Undefined if none. */
function extractInlineComment(rest: string): string | undefined {
  // If the value is quoted, only a `#` AFTER the closing quote is a comment.
  const quoted = /^\s*(['"]).*?\1\s+#\s?(.*)$/.exec(rest);
  if (quoted) return quoted[2]!.trim();
  const hash = rest.indexOf(" #");
  if (hash === -1) return undefined;
  return (
    rest
      .slice(hash + 2)
      .replace(/^#?\s*/, "")
      .trim() || undefined
  );
}

/**
 * Upsert `values` into the .env.local at `path`, preserving every other line.
 * - Existing `KEY=…` line (or a commented-out `# KEY=…`) → replaced in place.
 * - New key → appended.
 * - A key already set to the same value → untouched (idempotent).
 * Returns which keys were written (added or changed) vs left as-is.
 */
export function upsertEnvLocal(
  path: string,
  values: Record<string, string>,
): { written: string[]; unchanged: string[] } {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = existing.length ? existing.split("\n") : [];
  const written: string[] = [];
  const unchanged: string[] = [];
  const remaining = new Set(Object.keys(values));

  const next = lines.map((line) => {
    const m = LINE.exec(line);
    if (!m) return line;
    const key = m[2]!;
    if (!(key in values)) return line;
    remaining.delete(key);
    const desired = `${key}=${quoteIfNeeded(values[key]!)}`;
    if (line === desired) {
      unchanged.push(key);
      return line;
    }
    written.push(key);
    return desired;
  });

  // Append keys that had no line yet.
  const appended: string[] = [];
  for (const key of remaining) {
    appended.push(`${key}=${quoteIfNeeded(values[key]!)}`);
    written.push(key);
  }
  if (appended.length) {
    if (next.length && next[next.length - 1] !== "") next.push(""); // separator
    next.push("# added by @builders-stack/provision", ...appended);
  }

  writeFileSync(path, next.join("\n") + (next.at(-1) === "" ? "" : "\n"));
  return { written, unchanged };
}

/** Quote a value that contains whitespace or `#` so dotenv parsers keep it whole. */
function quoteIfNeeded(v: string): string {
  return /[\s#'"]/.test(v) ? JSON.stringify(v) : v;
}
