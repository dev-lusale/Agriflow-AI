import { expect, type Page } from "@playwright/test";

export async function demoLogin(page: Page, role: "Farmer" | "Buyer" | "Supplier" | "Transporter" | "Admin") {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

export async function selectProvinceDistrict(page: Page, province: string, district: string, prefix = "") {
  await page.locator(`select[name="${prefix ? prefix + "Province" : "province"}"]`).selectOption(province);
  await page.locator(`select[name="${prefix ? prefix + "District" : "district"}"]`).selectOption(district);
}

export async function expectToast(page: Page, text: RegExp | string) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

export const uid = () => Math.random().toString(36).slice(2, 8);
