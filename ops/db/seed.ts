// ops/db/seed.ts — operate entrypoint for seeding demo data.
//
// Thin wrapper over @stack/db's seed (libs/db/src/seed.ts). The seed logic lives
// with the schema in libs/db; this is just the one place the operate layer reaches
// for it. Needs a live DATABASE_URL and an existing schema (run ops/db/migrate.sh
// first). Run:  bun ops/db/seed.ts
const proc = Bun.spawnSync(["bun", "--filter", "@stack/db", "seed"], {
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(proc.exitCode ?? 1);
