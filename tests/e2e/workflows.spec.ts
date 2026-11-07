import { expect, test } from "@playwright/test";
import { demoLogin, expectToast, selectProvinceDistrict, uid } from "./helpers";

test.describe.configure({ mode: "serial" });

const run = uid();
const listingTitle = `E2E maize ${run}`;

test("A · farmer registers, onboards, creates a farm, field and maize crop", async ({ page }) => {
  await page.goto("/auth/register?role=FARMER");
  await page.getByLabel("Full name").fill(`E2E Farmer ${run}`);
  await page.getByLabel("Email").fill(`e2e-${run}@example.com`);
  await page.getByLabel("Password").fill("harvest2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");

  await selectProvinceDistrict(page, "SOUTHERN", "Choma");
  await page.getByLabel("Years of farming experience").fill("6");
  await page.locator("label", { hasText: /^Maize$/ }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.waitForURL("**/farmer/dashboard");
  await expect(page.getByText("Register your first farm")).toBeVisible();

  await page.goto("/farmer/farms/new");
  await page.getByLabel("Farm name").fill(`Choma Plot ${run}`);
  await selectProvinceDistrict(page, "SOUTHERN", "Choma");
  await page.getByLabel("Farm size").fill("5");
  await page.getByRole("button", { name: "Create farm" }).click();
  await page.waitForURL(/\/farmer\/farms\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: `Choma Plot ${run}`, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Field name").fill("Field A");
  await page.getByLabel("Area").fill("3");
  await page.getByRole("button", { name: "Add field" }).last().click();
  await expectToast(page, "Field added");

  await page.getByRole("button", { name: "Add crop" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('select[name="fieldId"]').selectOption({ label: "Field A" });
  await dialog.getByLabel("Variety").fill("SC 513");
  await dialog.getByLabel("Planting date").fill("2026-12-01");
  await dialog.getByLabel("Expected harvest").fill("2027-04-20");
  await dialog.locator('select[name="status"]').selectOption("GROWING");
  await dialog.getByRole("button", { name: "Add crop" }).click();
  await expectToast(page, "Crop added");

  await page.goto("/farmer/dashboard");
  await expect(page.getByText("SC 513")).toBeVisible();
  await expect(page.getByText("Active crops").first()).toBeVisible();
});

test("B · AI assistant answers (Grok or labelled fallback) and crop health assessment is saved", async ({ page }) => {
  await demoLogin(page, "Farmer");
  await page.goto("/farmer/assistant");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your question").fill("What are common signs of fall armyworm?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/armyworm/i).nth(1)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("text=/Grok|Built-in guidance/").first()).toBeVisible();

  await page.goto("/farmer/crop-health");
  await page.getByLabel("What do you see?").fill("Ragged holes in young maize leaves with sawdust-like frass in the whorl.");
  await page.getByRole("button", { name: "Analyse with Grok" }).click();
  await page.waitForURL(/crop-health\?a=/, { timeout: 120_000 });
  await expect(page.getByText("Your description")).toBeVisible();
});

test("C · farmer lists maize, buyer requests, farmer accepts, buyer confirms", async ({ page }) => {
  await demoLogin(page, "Farmer");
  await page.goto("/farmer/listings?new=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Produce name").fill(listingTitle);
  await dialog.getByLabel("Quantity available").fill("80");
  await dialog.getByLabel("Price per unit (ZMW)").fill("355");
  await dialog.getByRole("button", { name: "Publish listing" }).click();
  await expectToast(page, "Listing published");

  await demoLogin(page, "Buyer");
  await page.goto("/buyer/marketplace");
  await page.getByPlaceholder("Search maize, soybeans, district…").fill(listingTitle);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: new RegExp(listingTitle) }).click();
  await page.getByLabel(/Quantity/).first().fill("20");
  await page.getByRole("button", { name: "Send purchase request" }).click();
  await page.waitForURL("**/buyer/orders");
  await expect(page.getByText(listingTitle)).toBeVisible();

  await demoLogin(page, "Farmer");
  await page.goto("/farmer/notifications");
  await expect(page.getByText("New purchase request").first()).toBeVisible();
  await page.goto("/farmer/orders");
  await page.getByRole("row", { name: new RegExp(listingTitle) }).getByRole("link").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Accept order" }).click();
  await expectToast(page, "Order updated");

  await demoLogin(page, "Buyer");
  await page.goto("/buyer/orders");
  await page.getByRole("row", { name: new RegExp(listingTitle) }).getByRole("link").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirm purchase" }).click();
  await expectToast(page, "Order updated");
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

test("D · buyer requests transport; transporter accepts, picks up and delivers", async ({ page }) => {
  await demoLogin(page, "Buyer");
  await page.goto("/buyer/orders");
  await page.getByRole("row", { name: new RegExp(listingTitle) }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Request transport" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Pickup address / directions").fill("Mwale Family Farm store");
  await selectProvinceDistrict(page, "LUSAKA", "Lusaka", "dropoff");
  await dialog.getByLabel("Delivery address").fill("Lusaka depot");
  await dialog.getByRole("button", { name: "Request transport" }).click();
  await expectToast(page, "Delivery requested");

  await demoLogin(page, "Transporter");
  await page.goto("/transporter/requests");
  await page.locator("div", { hasText: listingTitle }).getByRole("link", { name: "Review & accept" }).first().click();
  await page.getByLabel("Your fee (ZMW)").fill("2400");
  await page.getByRole("button", { name: "Accept job" }).last().click();
  await expectToast(page, "Delivery updated");
  await page.getByRole("button", { name: "Record pickup" }).first().click();
  await page.getByRole("button", { name: "Record pickup" }).last().click();
  await expectToast(page, "Delivery updated");
  await page.getByRole("button", { name: "Confirm delivery" }).first().click();
  await page.getByLabel("Received by (name)").fill("Depot manager");
  await page.getByRole("button", { name: "Confirm delivery" }).last().click();
  await expectToast(page, "Delivery updated");
  await expect(page.getByText("Proof of delivery")).toBeVisible();
});

test("E · farmer records expenses and a sale; finances update", async ({ page }) => {
  await demoLogin(page, "Farmer");
  await page.goto("/farmer/finances");
  const before = await page.getByText("Net profit", { exact: true }).locator("..").textContent();
  for (const [type, cat, amount] of [
    ["EXPENSE", "FERTILIZER", "1200"],
    ["EXPENSE", "LABOUR", "800"],
    ["INCOME", "PRODUCE_SALE", "5000"],
  ] as const) {
    await page.getByRole("button", { name: "Record transaction" }).click();
    const d = page.getByRole("dialog");
    await d.locator('select[name="type"]').selectOption(type);
    await d.locator('select[name="category"]').selectOption(cat);
    await d.getByLabel("Amount (ZMW)").fill(amount);
    await d.getByLabel("Description").fill(`E2E ${run} ${cat}`);
    await d.getByRole("button", { name: "Save transaction" }).click();
    await expectToast(page, "Transaction recorded");
  }
  await page.reload();
  const after = await page.getByText("Net profit", { exact: true }).locator("..").textContent();
  expect(after).not.toEqual(before);
  await expect(page.getByText(`E2E ${run} PRODUCE_SALE`)).toBeVisible();
  await page.goto("/farmer/assistant?q=" + encodeURIComponent("How much profit did my farm make?"));
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=/Grok|Built-in guidance/").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".prose-ai").filter({ hasText: /profit|income/i }).first()).toBeVisible();
});

test("F · admin reviews platform, moderates, asks AI BI and generates a report", async ({ page }) => {
  await demoLogin(page, "Admin");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await expect(page.getByText("Farmers").first()).toBeVisible();
  await page.goto("/admin/marketplace?filter=ALL");
  await expect(page.getByRole("heading", { name: "Marketplace moderation" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Approve|Flag|Remove/ }).first()).toBeVisible();
  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await page.goto("/admin/deliveries");
  await expect(page.getByText("By status")).toBeVisible();
  await page.goto("/admin/ai");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your question").fill("Summarise agricultural marketplace activity this month.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=/Farmers|farmers/").nth(1)).toBeVisible({ timeout: 90_000 });
  await page.goto("/admin/reports");
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.waitForURL(/\/admin\/reports\/[a-z0-9]+$/, { timeout: 120_000 });
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});

test("security · role areas are enforced server-side", async ({ page }) => {
  await demoLogin(page, "Buyer");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/buyer\/dashboard/);
  await page.goto("/farmer/finances");
  await expect(page).toHaveURL(/\/buyer\/dashboard/);
  const res = await page.request.get("/api/export/transactions");
  expect(res.status()).toBe(403);
});
