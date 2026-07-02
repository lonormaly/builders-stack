// The event catalog is the one contract client and server share — pin its shape. `bun test`
import { expect, test } from "bun:test";
import { serverEvent, securityEvent, track } from "./events.js";

test("serverEvent builds the typed {event, properties} payload posthog-node expects", () => {
  const payload = serverEvent("user_signed_up", { email: "a@b.test" });
  expect(payload).toEqual({ event: "user_signed_up", properties: { email: "a@b.test" } });
});

test("securityEvent returns a capture()-shaped payload AND writes an audit line", () => {
  // The audit trail must ALWAYS fire (even without PostHog), so it writes to stdout.
  const logged: string[] = [];
  const orig = console.info;
  console.info = (msg: string) => logged.push(msg);
  try {
    const payload = securityEvent("user_123", "auth_signed_in", {});
    expect(payload).toEqual({ distinctId: "user_123", event: "auth_signed_in", properties: {} });
    const audit = JSON.parse(logged[0] ?? "{}");
    expect(audit.audit).toBe(true);
    expect(audit.event).toBe("auth_signed_in");
    expect(audit.actorId).toBe("user_123");
  } finally {
    console.info = orig;
  }
});

test("track is a no-op on the server (no window) and never throws", () => {
  // Guards the isomorphic contract: server code can import ./events and call track
  // without pulling posthog-js or crashing.
  expect(typeof window).toBe("undefined");
  expect(() => track("page_viewed", { path: "/" })).not.toThrow();
});
