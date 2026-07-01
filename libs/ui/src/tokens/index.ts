/**
 * Design tokens — the single source of truth, framework-agnostic.
 *
 * Plain data only: NO imports, NO DOM, NO React. This is the `@stack/ui/tokens`
 * entry point so React Native can consume it without pulling in the web
 * component layer (Radix / DOM). Values are hex + rem strings so they work in
 * both CSS and RN (`parseFloat` a rem for RN if you need a number).
 *
 * `src/styles/globals.css` mirrors the `colors` / `radii` values below into CSS
 * custom properties for the web. Keep the two in sync — this file is the source
 * of truth, the CSS is the derived copy.
 * ponytail: hand-mirrored instead of a codegen step. Add codegen only if the
 * token set grows past what's comfortable to keep in sync by eye.
 */

/** Semantic color roles, per theme. Web reads these via CSS vars; RN reads them from here. */
export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0b",
    card: "#ffffff",
    cardForeground: "#0a0a0b",
    popover: "#ffffff",
    popoverForeground: "#0a0a0b",
    primary: "#6d5efc",
    primaryForeground: "#ffffff",
    secondary: "#f4f4f6",
    secondaryForeground: "#1a1a20",
    muted: "#f4f4f6",
    mutedForeground: "#6b6b76",
    accent: "#f0eefe",
    accentForeground: "#3a2fb8",
    destructive: "#e5484d",
    destructiveForeground: "#ffffff",
    border: "#e6e6ea",
    input: "#e6e6ea",
    ring: "#6d5efc",
  },
  dark: {
    background: "#0b0b0e",
    foreground: "#f4f4f6",
    card: "#141418",
    cardForeground: "#f4f4f6",
    popover: "#141418",
    popoverForeground: "#f4f4f6",
    primary: "#8b7dff",
    primaryForeground: "#0b0b0e",
    secondary: "#22222a",
    secondaryForeground: "#f4f4f6",
    muted: "#22222a",
    mutedForeground: "#a1a1ad",
    accent: "#2a2540",
    accentForeground: "#d7d1ff",
    destructive: "#ff6369",
    destructiveForeground: "#0b0b0e",
    border: "#26262e",
    input: "#2c2c35",
    ring: "#8b7dff",
  },
} as const;

/** Raw brand ramp, in case a product needs a specific step outside the semantic roles. */
export const brand = {
  50: "#f0eefe",
  100: "#e4e0fd",
  200: "#ccc4fb",
  300: "#ab9ef8",
  400: "#8b7dff",
  500: "#6d5efc",
  600: "#5a45f0",
  700: "#4a37cc",
  800: "#3a2fb8",
  900: "#2f2894",
  950: "#1d1857",
} as const;

/** Spacing scale (rem). Matches Tailwind's 4px base at `spacing.1`. */
export const spacing = {
  0: "0rem",
  px: "1px",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

/** Border radius scale (rem). `base` is the shadcn `--radius` anchor. */
export const radii = {
  none: "0rem",
  sm: "0.375rem",
  md: "0.5rem",
  base: "0.625rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const typography = {
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.15",
    normal: "1.5",
    relaxed: "1.75",
  },
} as const;

export const tokens = {
  colors,
  brand,
  spacing,
  radii,
  typography,
} as const;

export type Tokens = typeof tokens;
export type ColorTheme = keyof typeof colors;
export type ColorRole = keyof typeof colors.light;
