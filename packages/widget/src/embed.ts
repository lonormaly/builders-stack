// IIFE entry — bundled to dist/widget.js for a plain <script src> embed on ANY
// third-party page. Self-mounting: it reads config off its own <script> tag's
// data-* attributes, so a host integrates with zero code:
//
//   <script src="https://cdn.example.com/widget.js"
//           data-endpoint="https://api.example.com/feedback"
//           data-label="Feedback" data-color="#6d5efc"></script>
//
// Also exposes `window.StackWidget.mount(opts)` for programmatic mounting.
import { mountFeedback } from "./widget";
import type { WidgetOptions } from "./config";

function optionsFromScriptTag(): WidgetOptions {
  const el = document.currentScript;
  if (!(el instanceof HTMLScriptElement)) return {};
  const { endpoint, label, color, position } = el.dataset;
  const opts: WidgetOptions = {};
  if (endpoint) opts.endpoint = endpoint;
  if (label) opts.label = label;
  if (color) opts.color = color;
  if (position === "bottom-left" || position === "bottom-right") opts.position = position;
  return opts;
}

declare global {
  interface Window {
    StackWidget?: { mount: (options?: WidgetOptions) => void };
  }
}

window.StackWidget = { mount: mountFeedback };

// Auto-mount from the script tag's data-* attributes.
mountFeedback(optionsFromScriptTag());
