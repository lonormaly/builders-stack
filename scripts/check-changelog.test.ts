import { describe, expect, test } from "bun:test";
import {
  addedUnreleasedEntry,
  isDependabotActor,
  touchesTriggerSurface,
  unreleasedSection,
} from "./check-changelog";

describe("touchesTriggerSurface — the same product-code surface fast.ts's other gates read", () => {
  test.each([
    "apps/web/app/page.tsx",
    "libs/seo/src/agent-readability.ts",
    "services/api/src/index.ts",
    "scripts/check-seo.ts",
    "ops/dev/worktree.sh",
    ".wt0-version",
    ".wt0-generated",
    ".wt0/hooks/pre-remove",
    "Tiltfile",
    "tilt_up.sh",
    "tilt_down.sh",
  ])("%s is in scope", (path) => {
    expect(touchesTriggerSurface(path)).toBe(true);
  });

  test.each(["docs/stack/changelog.md", "README.md", ".github/workflows/ci.yml", "package.json"])(
    "%s is out of scope (docs-only and root-config changes are exempt)",
    (path) => {
      expect(touchesTriggerSurface(path)).toBe(false);
    },
  );
});

describe("unreleasedSection", () => {
  test("extracts the content between the heading and the next ## heading", () => {
    const changelog = [
      "# Changelog",
      "",
      "## Unreleased",
      "",
      "### Added",
      "",
      "- a thing",
      "",
      "## 1.0.0 — 2026-01-01",
      "",
      "### Added",
      "",
      "- the first thing",
    ].join("\n");
    expect(unreleasedSection(changelog)).toBe("### Added\n\n- a thing");
  });

  test("returns the rest of the file when Unreleased is the last section", () => {
    const changelog = "# Changelog\n\n## Unreleased\n\n- only entry";
    expect(unreleasedSection(changelog)).toBe("- only entry");
  });

  test("returns empty for a file with no Unreleased section at all", () => {
    expect(unreleasedSection("# Changelog\n\n## 1.0.0\n\n- shipped")).toBe("");
  });
});

describe("addedUnreleasedEntry — the actual RED/GREEN law", () => {
  const base = "# Changelog\n\n## Unreleased\n\n### Added\n\n- an existing bullet\n";

  // RED: the PR's diff never touched CHANGELOG.md at all.
  test("RED: CHANGELOG.md untouched between base and head is caught", () => {
    expect(addedUnreleasedEntry(base, base)).toBe(false);
  });

  // RED: CHANGELOG.md changed, but only outside the Unreleased section (e.g.
  // editing a past release's notes) — still no new entry for this PR.
  test("RED: a change elsewhere in CHANGELOG.md, not under Unreleased, is caught", () => {
    const head = `${base}\n## 1.0.0 — 2026-01-01\n\n- typo fixed here\n`;
    expect(addedUnreleasedEntry(base, head)).toBe(false);
  });

  // RED: CHANGELOG.md doesn't exist yet at base or head — nothing was added.
  test("RED: no CHANGELOG.md at all is caught", () => {
    expect(addedUnreleasedEntry("", "")).toBe(false);
  });

  // GREEN: a new bullet lands under Unreleased.
  test("GREEN: a new bullet under Unreleased passes", () => {
    const head = base.replace(
      "- an existing bullet\n",
      "- an existing bullet\n- **a new change.** why it matters.\n",
    );
    expect(addedUnreleasedEntry(base, head)).toBe(true);
  });

  // GREEN: this PR is the one that creates CHANGELOG.md in the first place.
  test("GREEN: introducing CHANGELOG.md with its first Unreleased entry passes", () => {
    expect(addedUnreleasedEntry("", base)).toBe(true);
  });
});

describe("isDependabotActor", () => {
  test.each(["dependabot[bot]", "dependabot"])("%s is exempt", (actor) => {
    expect(isDependabotActor(actor)).toBe(true);
  });

  test.each([undefined, "", "lonormaly", "some-dependabot-fan"])("%s is not exempt", (actor) => {
    expect(isDependabotActor(actor)).toBe(false);
  });
});
