import type { Preview } from "@storybook/react-vite";

import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
  // Toolbar switch that toggles the `.dark` class the tokens key off of.
  globalTypes: {
    theme: {
      description: "Color theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as string;
      document.documentElement.classList.toggle("dark", theme === "dark");
      return Story();
    },
  ],
};

export default preview;
