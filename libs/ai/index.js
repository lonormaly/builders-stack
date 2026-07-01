export const ai = {
  async generateText({ prompt }) {
    return { text: "summary: " + String(prompt).slice(0, 40) };
  },
};
