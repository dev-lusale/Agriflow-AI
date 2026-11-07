/**
 * Runs a private PostgreSQL server for local development (no system install needed).
 * Data lives in ./.local-db (git-ignored). Port 5544. Creates `agriflow` and `agriflow_test`.
 * Usage: npm run db:local   (leave running; Ctrl+C to stop)
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const dir = path.resolve(process.cwd(), ".local-db");
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "agriflow",
  port: 5544,
  persistent: true,
  onLog: () => {},
});

async function main() {
  const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
  if (fresh) {
    console.log("Initialising local Postgres cluster in .local-db …");
    await pg.initialise();
  }
  await pg.start();
  for (const db of ["agriflow", "agriflow_test"]) {
    try {
      await pg.createDatabase(db);
      console.log(`Created database ${db}`);
    } catch {
      /* already exists */
    }
  }
  console.log("Local Postgres ready on postgresql://postgres:agriflow@localhost:5544 (Ctrl+C to stop)");
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
