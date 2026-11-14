/**
 * P19-1: the public inquiry form carries no visible captcha (no Cloudflare iframe / "testing only"
 * box). Bot protection is invisible: a hidden honeypot and a server-signed render timestamp.
 * A human fill+submit creates a lead; a bot-filled honeypot or an instant submit shows the same
 * success but stores nothing. Runs against the production build on a LOCAL database.
 */
import { expect, test, type Page } from "@playwright/test";
import { SITE, q } from "./helpers";

test.skip(({ viewport }) => (viewport?.width ?? 1280) < 1000, "desktop only");

const stamp = Date.now();
const leadCount = async (email: string) =>
  Number(
    (await q<{ n: string }>(`select count(*)::int n from leads where email=$1`, [email]))[0]?.n,
  );

async function fill(page: Page, email: string) {
  await page.getByLabel("Full name").fill("P19 Tester");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Message").fill("We would like a quote for a custom internal portal.");
}

test("no Cloudflare widget, no test copy, honeypot invisible", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto(`${SITE}/contact`);
  await expect(page.getByRole("button", { name: "Send inquiry" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(await page.locator("iframe").count()).toBe(0);
  const text = (await page.locator("body").innerText()).toLowerCase();
  expect(text).not.toMatch(/testing only|report to the site owner|cloudflare|turnstile/);
  expect(requested.filter((u) => u.includes("cloudflare.com"))).toEqual([]);

  const hp = page.locator('input[name="website_url"]');
  expect(await hp.count()).toBe(1);
  await expect(hp).not.toBeInViewport();
  expect(await hp.evaluate((el) => (el as HTMLInputElement).tabIndex)).toBe(-1);
  expect(await hp.getAttribute("autocomplete")).toBe("off");
  expect(await hp.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
  const box = await hp.boundingBox();
  expect(!box || box.x + box.width <= 0 || box.y < 0 || box.x < 0).toBe(true);
});

test("human submit shows success and creates a lead", async ({ page }) => {
  const email = `p19-human-${String(stamp)}@example.com`;
  await page.goto(`${SITE}/contact`);
  await page.waitForLoadState("networkidle");
  await fill(page, email);
  await page.waitForTimeout(2600); // a real person takes longer than the 2 s time trap
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByText(/your inquiry is in/i)).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => leadCount(email), { timeout: 10_000 }).toBe(1);
});

test("filled honeypot: same success, no lead", async ({ page }) => {
  const email = `p19-bot-${String(stamp)}@example.com`;
  await page.goto(`${SITE}/contact`);
  await page.waitForLoadState("networkidle");
  await fill(page, email);
  await page.locator('input[name="website_url"]').evaluate((el) => {
    (el as HTMLInputElement).value = "http://spam.example";
  });
  await page.waitForTimeout(2600);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByText(/your inquiry is in/i)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(await leadCount(email)).toBe(0);
});

test("instant submit (time trap): same success, no lead", async ({ page }) => {
  const email = `p19-fast-${String(stamp)}@example.com`;
  await page.goto(`${SITE}/contact`);
  await expect(page.getByRole("button", { name: "Send inquiry" })).toBeVisible();
  // let the signed render token arrive (fetched on hydrate), then submit inside the 2 s window
  await page.waitForTimeout(400);
  await fill(page, email);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByText(/your inquiry is in/i)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(await leadCount(email)).toBe(0);
});
