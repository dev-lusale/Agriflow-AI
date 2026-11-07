import { expect, test, type Page } from "@playwright/test";

/**
 * Production smoke suite: runs real user journeys against a deployed site with demo mode OFF.
 *   PROD_SMOKE=1 E2E_BASE_URL=https://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npx playwright test tests/e2e/production.spec.ts
 * Creates accounts with emails "smoke-<run>-…@example.com"; clean them up afterwards (see docs/DEPLOYMENT.md).
 */
test.skip(!process.env.PROD_SMOKE, "Set PROD_SMOKE=1 to run against a deployment.");
test.describe.configure({ mode: "serial" });

const run = process.env.SMOKE_RUN ?? `${Date.now().toString(36)}`;
const farmerEmail = `smoke-${run}-farmer@example.com`;
const buyerEmail = `smoke-${run}-buyer@example.com`;
const password = `Smoke${run}9x`;
const listingTitle = `Smoke maize ${run}`;

async function register(page: Page, role: "FARMER" | "BUYER", name: string, email: string) {
  await page.context().clearCookies();
  await page.goto(`/auth/register?role=${role}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  await page.locator('select[name="province"]').selectOption("SOUTHERN");
  await page.locator('select[name="district"]').selectOption("Choma");
}

async function login(page: Page, email: string, pw: string) {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

/** Fetch from inside the browser so requests follow the browser's network settings. */
const statusOf = (page: Page, paths: string[]) =>
  page.evaluate(async (ps) => Promise.all(ps.map(async (p) => [p, (await fetch(p, { redirect: "manual" })).status] as const)), paths);

test("public site, PWA assets and demo mode off", async ({ page }) => {
  await page.goto("/");
  const pages = ["/", "/features", "/how-it-works", "/marketplace", "/marketplace/prices", "/suppliers", "/logistics", "/about", "/contact", "/faq", "/privacy", "/terms", "/auth/login", "/auth/register", "/offline"];
  const assets = ["/manifest.webmanifest", "/sw.js", "/favicon.ico", "/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-maskable-512.png", "/brand/agriflow-logo.png", "/opengraph-image.png"];
  for (const [p, st] of await statusOf(page, [...pages, ...assets])) expect(st, p).toBe(200);
  const health = await page.evaluate(async () => (await fetch("/api/health")).json());
  expect(health).toMatchObject({ status: "ok", database: "ok", demoMode: false });
  await page.goto("/auth/login");
  await expect(page.getByText("Demo mode")).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
});

test("farmer: register → onboard → farm → field → crop → activity → dashboard", async ({ page }) => {
  await register(page, "FARMER", "Smoke Test Farmer", farmerEmail);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/farmer/dashboard");

  await page.goto("/farmer/farms/new");
  await page.getByLabel("Farm name").fill(`Smoke Farm ${run}`);
  await page.locator('select[name="province"]').selectOption("SOUTHERN");
  await page.locator('select[name="district"]').selectOption("Choma");
  await page.getByLabel("Farm size").fill("5");
  await page.getByRole("button", { name: "Create farm" }).click();
  await page.waitForURL(/\/farmer\/farms\/[a-z0-9]+$/);

  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Field name").fill("Field A");
  await page.getByLabel("Area").fill("3");
  await page.getByRole("button", { name: "Add field" }).last().click();
  await expect(page.getByText("Field added").first()).toBeVisible();

  await page.getByRole("button", { name: "Add crop" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Variety").fill("SC 513");
  await d.getByLabel("Planting date").fill("2026-12-01");
  await d.getByLabel("Expected harvest").fill("2027-04-20");
  await d.locator('select[name="status"]').selectOption("GROWING");
  await d.getByRole("button", { name: "Add crop" }).click();
  await expect(page.getByText("Crop added").first()).toBeVisible();

  await page.goto("/farmer/activities?new=1");
  const a = page.getByRole("dialog");
  await a.locator('select[name="type"]').selectOption("FERTILIZER_APPLICATION");
  await a.getByLabel("Cost (ZMW)").fill("1200");
  await a.getByRole("button", { name: "Save activity" }).click();
  await expect(page.getByText("Activity recorded").first()).toBeVisible();

  await page.goto("/farmer/dashboard");
  await expect(page.getByText("SC 513")).toBeVisible();
  await expect(page.getByText("−K 1,200.00").or(page.getByText("-K 1,200.00")).or(page.getByText("K 1,200.00")).first()).toBeVisible();
});

test("farmer: weather, AI assistant and crop-health photo upload (storage)", async ({ page }) => {
  await login(page, farmerEmail, password);
  await page.goto("/farmer/weather");
  await expect(page.getByText(/Open-Meteo/).first()).toBeVisible({ timeout: 60_000 });

  await page.goto("/farmer/assistant");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your question").fill("What are common signs of fall armyworm?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=/Grok|Built-in guidance/").first()).toBeVisible({ timeout: 90_000 });

  await page.goto("/farmer/crop-health");
  await page.waitForLoadState("networkidle");
  await page.locator('input[name="image"]').setInputFiles("public/icons/icon-192.png");
  await page.getByLabel("What do you see?").fill("Ragged holes in young maize leaves with frass in the whorl.");
  await page.getByRole("button", { name: "Analyse with Grok" }).click();
  await page.waitForURL(/crop-health\?a=/, { timeout: 120_000 });
  const img = page.locator('img[alt="Submitted crop"]');
  await expect(img).toBeVisible();
  // the photo is served back from private storage through the authorised route
  await expect.poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("marketplace: farmer lists, buyer requests, farmer accepts, buyer confirms", async ({ page }) => {
  await login(page, farmerEmail, password);
  await page.goto("/farmer/listings?new=1");
  const d = page.getByRole("dialog");
  await d.getByLabel("Produce name").fill(listingTitle);
  await d.getByLabel("Quantity available").fill("50");
  await d.getByLabel("Price per unit (ZMW)").fill("350");
  await d.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByText("Listing published").first()).toBeVisible();

  await register(page, "BUYER", "Smoke Test Buyer", buyerEmail);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/buyer/dashboard");
  await page.goto(`/buyer/marketplace?q=${encodeURIComponent(listingTitle)}`);
  await page.getByRole("link", { name: new RegExp(listingTitle) }).click();
  await page.getByLabel(/Quantity/).first().fill("10");
  await page.getByRole("button", { name: "Send purchase request" }).click();
  await page.waitForURL("**/buyer/orders");

  await login(page, farmerEmail, password);
  await page.goto("/farmer/orders");
  await page.getByRole("row", { name: new RegExp(listingTitle) }).getByRole("link").first().click();
  page.once("dialog", (x) => x.accept());
  await page.getByRole("button", { name: "Accept order" }).click();
  await expect(page.getByText("Order updated").first()).toBeVisible();

  await login(page, buyerEmail, password);
  await page.goto("/buyer/orders");
  await page.getByRole("row", { name: new RegExp(listingTitle) }).getByRole("link").first().click();
  page.once("dialog", (x) => x.accept());
  await page.getByRole("button", { name: "Confirm purchase" }).click();
  await expect(page.getByText("Order updated").first()).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

test("security: buyer cannot reach farmer/admin areas or exports", async ({ page }) => {
  await login(page, buyerEmail, password);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/buyer\/dashboard/);
  expect((await statusOf(page, ["/api/export/transactions"]))[0]![1]).toBe(403);
  await page.context().clearCookies();
  const syncStatus = await page.evaluate(async () => (await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops: [] }) })).status);
  expect(syncStatus).toBe(401);
});

test("admin: super-admin signs in and sees live platform data", async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, "Admin credentials not provided");
  await login(page, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await page.goto("/admin/users?q=smoke-" + run);
  await expect(page.getByText(farmerEmail)).toBeVisible();
  await page.goto("/admin/settings");
  await expect(page.getByText("Supabase Storage")).toBeVisible();
});
