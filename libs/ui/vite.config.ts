import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Storybook's @storybook/react-vite auto-merges this config, so the
// Tailwind v4 plugin here is what compiles `@import "tailwindcss"` in
// globals.css. This package ships source only (no lib build step).
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
