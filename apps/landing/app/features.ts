// The feature list shown on the landing page — pulled out to its own module so the
// WebMCP describe_product tool (WebMcpTools.tsx) reads the exact same data the page
// renders, instead of a second hand-copied list that can drift.
export const FEATURES = [
  {
    title: "apps · services · libs",
    body: "Three folders defined by exposure. Every role has a home, so you never restructure — you just add.",
  },
  {
    title: "One design system",
    body: "@stack/ui ships shadcn components + shared tokens. Web and native render the exact same brand.",
  },
  {
    title: "Batteries, env-gated",
    body: "Auth, payments, email, analytics — all wired, all silent no-ops until you add keys.",
  },
];
