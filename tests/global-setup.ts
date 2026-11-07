import { execSync } from "node:child_process";

/** Apply migrations to the test database once before the suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:agriflow@localhost:5544/agriflow_test";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe" });
}
