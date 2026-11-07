// Dev helper: sign in as a demo role and screenshot pages, reporting console/page errors.
// Usage: node scripts/smoke-shots.mjs <ROLE> <outDir> /path1 /path2 ...
import { chromium } from "@playwright/test";

const [role, outDir, ...paths] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const mobile = process.env.MOBILE === "1";
const browser = await chromium.launch();
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 200)}`));

if (role && role !== "NONE") {
  await page.goto(`${base}/auth/login`, { waitUntil: "networkidle", timeout: 120000 });
  const label = { FARMER: "Farmer", BUYER: "Buyer", SUPPLIER: "Supplier", TRANSPORTER: "Transporter", ADMIN: "Admin" }[role];
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 120000 });
}
for (const p of paths) {
  const res = await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 180000 });
  const name = (p.replace(/[^a-z0-9]+/gi, "_") || "home").replace(/^_/, "") || "home";
  await page.screenshot({ path: `${outDir}/${role}-${name}${mobile ? "-m" : ""}.png`, fullPage: !mobile });
  const title = await page.title();
  const errText = await page.locator("text=/Application error|Unhandled Runtime Error|Something went wrong/").count();
  console.log(`${res?.status()} ${p} "${title}"${errText ? " [ERROR UI]" : ""}`);
}
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].slice(0, 20).join("\n"));
await browser.close();
