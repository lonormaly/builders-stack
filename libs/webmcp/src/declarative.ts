// The declarative fallback: WebMCP's HTML-attribute form of tool registration, for a
// plain `<form>` an agent can call without any JS running `registerTool()`. Spec status
// as of 2 September 2026 (see docs/stack/webmcp.md for the exact source + date):
//
//   - Defined in declarative-api-explainer.md, NOT the main index.bs spec — the main
//     spec's declarative section is literally "This section is entirely a TODO".
//   - Input-schema synthesis from form controls and the form-response mechanism are
//     both open issues (webmachinelearning/webmcp#135).
//   - Chromium is reportedly testing a "loose version"; no shipped browser support.
//
// These helpers exist so a form's tool attributes are typed and centrally documented
// instead of hand-typed strings scattered across JSX — they do NOT register anything
// themselves (there's no JS API for the declarative form; the browser reads the
// attributes directly), and they're additive to (not a replacement for) registerTool().
// Treat this as experimental: it may need to change when the explainer's open
// questions resolve.

export interface DeclarativeToolFormProps {
  toolname: string;
  tooldescription: string;
  toolautosubmit?: boolean;
}

/** Spread onto a `<form>` to declare it as a WebMCP tool. */
export function declarativeToolForm(input: {
  name: string;
  description: string;
  autoSubmit?: boolean;
}): DeclarativeToolFormProps {
  return {
    toolname: input.name,
    tooldescription: input.description,
    ...(input.autoSubmit ? { toolautosubmit: true } : {}),
  };
}

export interface DeclarativeToolParamProps {
  toolparamdescription: string;
}

/** Spread onto a form control (`<input>`, `<select>`, …) to describe that one field. */
export function declarativeToolParam(description: string): DeclarativeToolParamProps {
  return { toolparamdescription: description };
}
