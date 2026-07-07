// bun:test — pins the widget's pure core (config merge + payload shape). No DOM.
import { describe, expect, test } from "bun:test";
import { buildPayload, DEFAULTS, isValidEndpoint, resolveConfig } from "./config";

describe("resolveConfig", () => {
  test("empty options → all defaults (color from @stack/ui tokens)", () => {
    expect(resolveConfig()).toEqual(DEFAULTS);
    expect(DEFAULTS.color).toMatch(/^#/); // sourced from the design-token primary
  });

  test("host options override defaults, untouched fields keep defaults", () => {
    const cfg = resolveConfig({ endpoint: "https://x/f", label: "Report a bug" });
    expect(cfg.endpoint).toBe("https://x/f");
    expect(cfg.label).toBe("Report a bug");
    expect(cfg.position).toBe(DEFAULTS.position);
  });

  test("position is honored", () => {
    expect(resolveConfig({ position: "bottom-left" }).position).toBe("bottom-left");
  });
});

describe("isValidEndpoint", () => {
  test("accepts https, rejects http / non-URL / other protocols", () => {
    expect(isValidEndpoint("https://api.example.com/feedback")).toBe(true);
    expect(isValidEndpoint("http://evil.example.com")).toBe(false); // plaintext
    expect(isValidEndpoint("javascript:alert(1)")).toBe(false);
    expect(isValidEndpoint("not a url")).toBe(false);
    expect(isValidEndpoint("")).toBe(false);
  });
});

describe("buildPayload", () => {
  test("trims message, stamps url + ISO time", () => {
    const at = new Date("2026-07-03T10:00:00.000Z");
    const p = buildPayload("  hello  ", "https://host/page", at);
    expect(p).toEqual({ message: "hello", url: "https://host/page", at: at.toISOString() });
  });
});
