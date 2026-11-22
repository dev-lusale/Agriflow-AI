// Vercel build entry point.
// Production builds first apply any committed, not-yet-applied migrations (`prisma migrate deploy`
// never resets or drops data by itself; it only runs the SQL files in prisma/migrations that are new).
// Preview builds never touch the database.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  console.log("[vercel-build] Production: applying pending database migrations…");
  run("npx prisma migrate deploy");
} else {
  console.log(`[vercel-build] ${process.env.VERCEL_ENV ?? "local"} build: skipping migrations.`);
}
run("npm run build");
