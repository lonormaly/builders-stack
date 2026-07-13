// bun:test — pins the env gate (no token → no external drain) and reportError shaping.
import { afterEach, describe, expect, mock, test } from "bun:test";

const TOKEN_KEY = "BETTERSTACK_SOURCE_TOKEN";

afterEach(() => {
  delete process.env[TOKEN_KEY];
  mock.restore();
});

describe("log — env gate", () => {
  test("no token → does NOT hit the network (silent no-op drain)", async () => {
    delete process.env[TOKEN_KEY];
    const fetchSpy = mock(() => Promise.resolve(new Response()));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { log } = await import("./index");
    log("info", "hello");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("token set → POSTs the event with a Bearer auth header", async () => {
    process.env[TOKEN_KEY] = "src_test";
    const fetchSpy = mock(() => Promise.resolve(new Response()));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { log } = await import("./index");
    log("error", "boom", { service: "api" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer src_test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ level: "error", message: "boom", service: "api" });
  });
});

describe("reportError", () => {
  test("extracts message + stack from an Error", async () => {
    process.env[TOKEN_KEY] = "src_test";
    const fetchSpy = mock(() => Promise.resolve(new Response()));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { reportError } = await import("./index");
    reportError(new Error("kaboom"), { path: "/checkout" });
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.message).toBe("kaboom");
    expect(body.path).toBe("/checkout");
    expect(typeof body.stack).toBe("string");
  });
});
