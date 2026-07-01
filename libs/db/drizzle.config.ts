import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from the environment (see .env.example). drizzle-kit loads
// .env automatically; the `!` asserts it's present — the CLI errors clearly if not.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema.ts", "./src/auth-schema.ts"],
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
