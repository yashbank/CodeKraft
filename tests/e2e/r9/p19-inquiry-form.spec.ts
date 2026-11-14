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

// public_form allows 5 submits/hour/IP (in-memory limiter in the server): give each test its own IP.
test.beforeEach(async ({ context }) => {
  const o = () => Math.floor(Math.random() * 250);
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${o()}.${o()}.${o()}` });
});

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

test("instant submit (time trap): retry message, nothing stored, resubmit after waiting succeeds", async ({
  page,
}) => {
  const email = `p19-fast-${String(stamp)}@example.com`;
  await page.goto(`${SITE}/contact`);
  await expect(page.getByRole("button", { name: "Send inquiry" })).toBeVisible();
  // let the signed render token arrive (fetched on hydrate), then submit inside the 2 s window
  await page.waitForTimeout(400);
  await fill(page, email);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Please wait a moment" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/your inquiry is in/i)).toHaveCount(0);
  expect(await leadCount(email)).toBe(0);
  // typed values are kept
  await expect(page.getByLabel("Work email")).toHaveValue(email);
  await expect(page.getByLabel("Full name")).toHaveValue("P19 Tester");
  // a human retries a moment later: same form, same token, now old enough
  await page.waitForTimeout(2300);
  await page.getByRole("button", { name: /send inquiry|try again/i }).click();
  await expect(page.getByText(/your inquiry is in/i)).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => leadCount(email), { timeout: 10_000 }).toBe(1);
});

test("register: instant submit shows retry message, then succeeds and creates the user", async ({
  page,
}) => {
  const email = `p19-reg-${String(stamp)}@example.com`;
  await q(`delete from rate_limit_buckets`);
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto(`${SITE}/auth/register`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await page.locator("#reg-name").fill("P19 Register");
  await page.locator("#reg-email").fill(email);
  await page.locator("#reg-password").fill("R9-Thirteen-Pass#2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Please wait a moment and try again/i)).toBeVisible({
    timeout: 15_000,
  });
  const users = async () =>
    Number(
      (await q<{ n: string }>(`select count(*)::int n from users where email=$1`, [email]))[0]?.n,
    );
  expect(await users()).toBe(0);
  await expect(page.locator("#reg-email")).toHaveValue(email);
  await page.waitForTimeout(2300);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(/check your email|verification|Continue to your account/i).first(),
  ).toBeVisible({ timeout: 90_000 });
  expect(await users()).toBe(1);
});
