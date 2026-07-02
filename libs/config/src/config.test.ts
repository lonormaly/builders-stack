// The typed-env door is a trust boundary — parse it, don't trust it. `bun test`
import { expect, test } from "bun:test";
import { EnvSchema } from "./index.js";

test("EnvSchema accepts an empty env and applies safe defaults (boots keyless)", () => {
  const env = EnvSchema.parse({});
  expect(env.NODE_ENV).toBe("development");
  expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
  expect(env.POSTHOG_HOST).toBe("https://us.i.posthog.com");
  expect(env.POSTHOG_API_KEY).toBeUndefined();
  expect(env.SITE_NAME).toBe("Builder's Stack");
  expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
});

test("EnvSchema accepts valid overrides", () => {
  const env = EnvSchema.parse({
    NODE_ENV: "production",
    WEB_ORIGIN: "https://app.example.com",
    POSTHOG_API_KEY: "phc_x",
  });
  expect(env.NODE_ENV).toBe("production");
  expect(env.WEB_ORIGIN).toBe("https://app.example.com");
  expect(env.POSTHOG_API_KEY).toBe("phc_x");
});

test("EnvSchema rejects a non-URL WEB_ORIGIN (fail fast on misconfig)", () => {
  expect(() => EnvSchema.parse({ WEB_ORIGIN: "not-a-url" })).toThrow();
});

test("EnvSchema rejects an out-of-enum NODE_ENV", () => {
  expect(() => EnvSchema.parse({ NODE_ENV: "staging" })).toThrow();
});
