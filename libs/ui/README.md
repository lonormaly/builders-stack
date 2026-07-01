# @stack/ui

The design system for the stack: **design tokens** (shared by web and React
Native), a set of **shadcn/ui** components on **Tailwind CSS v4**, and
**Storybook** for browsing them.

- Tailwind v4 (CSS-first, `@import "tailwindcss"` + `@theme inline`)
- shadcn/ui components (Radix primitives, `class-variance-authority`, `cn`)
- One source of truth for tokens in `src/tokens/index.ts`; the web reads the
  same values as CSS variables from `src/styles/globals.css`.

## Entry points

| Import                 | What you get                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `@stack/ui`            | Components + `cn` (web; pulls in Radix/DOM).                          |
| `@stack/ui/tokens`     | Framework-agnostic tokens — **safe for React Native** (no DOM/React). |
| `@stack/ui/styles.css` | The Tailwind v4 stylesheet (import once in a web app).                |

Always import through these doors — never deep-path into `src/`.

## Storybook

```bash
bun run storybook        # dev server on http://localhost:6006
bun run build-storybook  # static build
bun run typecheck        # tsc --noEmit
```

The toolbar has a light/dark switch (toggles the `.dark` class the tokens key
off of).

## Consuming in a Next.js app

```css
/* app/globals.css */
@import "@stack/ui/styles.css";
```

```tsx
import { Button, Card, CardHeader, CardTitle, cn } from "@stack/ui";

export function Example() {
  return (
    <Card className={cn("max-w-sm")}>
      <CardHeader>
        <CardTitle>Hello</CardTitle>
      </CardHeader>
    </Card>
  );
}
```

Next.js consumes the TypeScript source directly, so add `@stack/ui` to
`transpilePackages` in `next.config`. Class-based dark mode: put `.dark` on
`<html>` (e.g. via `next-themes` with `attribute="class"`).

## Consuming tokens in React Native

Only import the `tokens` entry — it has zero DOM/React dependencies:

```ts
import { colors, spacing, radii } from "@stack/ui/tokens";

const styles = {
  card: {
    backgroundColor: colors.light.card,
    borderRadius: parseFloat(radii.md) * 16, // rem string -> px
    padding: parseFloat(spacing[4]) * 16,
  },
};
```

## Adding a component

This package is configured for the shadcn CLI (`components.json`, Tailwind v4
shape). Add a component, then export it from `src/index.ts` and drop a
`*.stories.tsx` next to it under `src/components/`.
