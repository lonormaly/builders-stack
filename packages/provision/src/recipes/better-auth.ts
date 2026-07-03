import { randomBytes } from "node:crypto";
import type { Recipe } from "../recipe";

// ponytail: generate-only — no API, no validate, no autoProvision needed
export const recipe: Recipe = {
  id: "better-auth",
  title: "Better Auth",
  mode: "generate",
  envVars: ["BETTER_AUTH_SECRET"],
  docsUrl: "https://www.better-auth.com/docs/installation",
  generate(): Record<string, string> {
    return { BETTER_AUTH_SECRET: randomBytes(32).toString("base64url") };
  },
};

export default recipe;
