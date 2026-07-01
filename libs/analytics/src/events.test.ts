// The event catalog is the one contract client and server share — pin its shape. `bun test`
import { expect, test } from "bun:test";
import { serverEvent, track } from "./events.js";

test("serverEvent builds the typed {event, properties} payload posthog-node expects", () => {
  const payload = serverEvent("user_signed_up", { email: "a@b.test" });
  expect(payload).toEqual({ event: "user_signed_up", properties: { email: "a@b.test" } });
});

test("track is a no-op on the server (no window) and never throws", () => {
  // Guards the isomorphic contract: server code can import ./events and call track
  // without pulling posthog-js or crashing.
  expect(typeof window).toBe("undefined");
  expect(() => track("page_viewed", { path: "/" })).not.toThrow();
});
