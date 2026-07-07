// The DOM layer — mounts a floating launcher + a tiny feedback popover into the
// host page. Vanilla DOM, zero framework, so the IIFE bundle drops into ANY site.
import { buildPayload, resolveConfig, isValidEndpoint, type WidgetOptions } from "./config";

const ROOT_ID = "stack-widget-root";

/** Mount the feedback widget into `document.body`. Idempotent (mounts once). */
export function mountFeedback(options: WidgetOptions = {}): void {
  if (typeof document === "undefined") return; // SSR / non-browser: no-op.
  if (document.getElementById(ROOT_ID)) return; // already mounted.

  const cfg = resolveConfig(options);
  const side = cfg.position === "bottom-left" ? "left: 20px" : "right: 20px";

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.cssText = `position: fixed; bottom: 20px; ${side}; z-index: 2147483647; font-family: system-ui, sans-serif;`;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = cfg.label;
  button.setAttribute("aria-label", `Open ${cfg.label} form`);
  button.style.cssText = `background: ${cfg.color}; color: #fff; border: 0; border-radius: 9999px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.2);`;

  const panel = document.createElement("form");
  panel.hidden = true;
  panel.style.cssText = `display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; padding: 12px; width: 260px; background: #fff; color: #111; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.25);`;

  const input = document.createElement("textarea");
  input.rows = 3;
  input.placeholder = "What's on your mind?";
  input.setAttribute("aria-label", "Your feedback");
  input.style.cssText =
    "resize: vertical; border: 1px solid #e6e6ea; border-radius: 8px; padding: 8px; font: inherit;";

  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Send";
  send.style.cssText = `background: ${cfg.color}; color: #fff; border: 0; border-radius: 8px; padding: 8px; font-weight: 600; cursor: pointer;`;

  panel.append(input, send);
  root.append(panel, button);
  document.body.appendChild(root);

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });

  panel.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = buildPayload(input.value, location.href);
    if (!payload.message) return;
    if (cfg.endpoint && isValidEndpoint(cfg.endpoint)) {
      // Fire-and-forget; keepalive lets it survive a navigation.
      void fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit", // explicit: never send cookies to a host-controlled endpoint.
        keepalive: true,
      }).catch(() => undefined);
    }
    input.value = "";
    panel.hidden = true;
  });
}
