import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from the environment (see .env.example). drizzle-kit loads
// .env automatically; we assert it's present here so the CLI errors clearly if not.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema.ts", "./src/auth-schema.ts"],
  out: "./migrations",
  dbCredentials: { url },
});
