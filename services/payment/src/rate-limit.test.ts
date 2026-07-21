// Money/security path → gets a runnable check. `bun test`
import { expect, test } from "bun:test";
import { createRateLimiter } from "./rate-limit.js";

test("allows up to the limit inside one window, then blocks", () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 60_000 });
  const t0 = 1_000_000;
  expect(rl.check("ip1", t0)).toBe(true);
  expect(rl.check("ip1", t0 + 1)).toBe(true);
  expect(rl.check("ip1", t0 + 2)).toBe(true);
  expect(rl.check("ip1", t0 + 3)).toBe(false);
  expect(rl.check("ip1", t0 + 4)).toBe(false);
});

test("keys are independent", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 60_000 });
  const t0 = 1_000_000;
  expect(rl.check("ip1", t0)).toBe(true);
  expect(rl.check("ip1", t0)).toBe(false);
  expect(rl.check("ip2", t0)).toBe(true);
});

test("budget resets when the window elapses", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 60_000 });
  const t0 = 1_000_000;
  expect(rl.check("ip1", t0)).toBe(true);
  expect(rl.check("ip1", t0 + 59_999)).toBe(false);
  expect(rl.check("ip1", t0 + 60_000)).toBe(true);
});
