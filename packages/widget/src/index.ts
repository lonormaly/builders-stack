// @stack/widget — the ESM entry for npm consumers.
//
//   import { mountFeedback } from "@stack/widget";
//   mountFeedback({ endpoint: "https://api.example.com/feedback" });
//
// For a <script src> embed on a third-party site, use the IIFE build instead
// (dist/widget.js) — see src/embed.ts and demo/index.html.
export { mountFeedback } from "./widget";
export {
  resolveConfig,
  buildPayload,
  DEFAULTS,
  type WidgetOptions,
  type ResolvedConfig,
  type WidgetPosition,
  type FeedbackPayload,
} from "./config";
