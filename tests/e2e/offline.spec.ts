import { expect, test } from "@playwright/test";
import { demoLogin, uid } from "./helpers";

/**
 * Offline-first flow (requires a production server: the service worker only registers in production).
 * Saves an activity while offline, verifies the "awaiting sync" state, then reconnects and verifies it synced.
 */
test("offline · activity saved locally, then synchronised on reconnect", async ({ page, context }) => {
  test.skip(!!process.env.E2E_BASE_URL?.includes(":3000"), "Service worker is disabled in development; run against `next start`.");
  const note = `Offline weeding ${uid()}`;
  await demoLogin(page, "Farmer");
  await page.goto("/offline");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('select[name="farmId"]')).toBeVisible(); // farm list cached for offline use
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload().catch(() => null); // served from the service worker cache
  await expect(page.getByText("You are offline")).toBeVisible();
  await page.locator('select[name="type"]').selectOption("WEED_MANAGEMENT");
  await page.locator('textarea[name="notes"]').fill(note);
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText("Saved locally · awaiting sync").first()).toBeVisible();

  // an authenticated page falls back to the offline shell instead of failing
  await page.goto("/farmer/activities").catch(() => null);
  await expect(page.getByRole("heading", { name: "Offline farm records" })).toBeVisible();

  await context.setOffline(false);
  await page.goto("/offline");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Synced").first()).toBeVisible({ timeout: 60_000 });

  await expect(async () => {
    await page.goto("/farmer/activities");
    await expect(page.getByText(note)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText("synced from offline").first()).toBeVisible();
});
