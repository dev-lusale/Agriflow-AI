import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the main workflows (A–F).
 * - Default: builds nothing; starts `next start` on E2E_PORT (run `npm run build` first).
 * - Set E2E_BASE_URL to test an already running server (e.g. `npm run dev`).
 * Requires a seeded database (`npm run db:seed`) with DEMO_MODE=true for demo sign-in.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    // Optional: E2E_HOST_MAP="MAP example.vercel.app 76.76.21.21" when a network cannot route to some edge IPs
    launchOptions: process.env.E2E_HOST_MAP ? { args: [`--host-resolver-rules=${process.env.E2E_HOST_MAP}`] } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next start -p ${PORT}`, url: `${BASE}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
