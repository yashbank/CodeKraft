/**
 * D17 browser proof on a production build, local DB. Run the server with CSP_MODE=enforce, so a
 * page that lost its scripts fails here instead of only logging a report.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, SITE, loginAs, q } from "./helpers";

const SLUG = "resume-portfolio-website";

function watchCsp(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) seen.push(`${page.url()}: ${m.text()}`);
  });
  return seen;
}

async function visit(page: Page, url: string): Promise<string> {
  const res = await page.goto(url, { waitUntil: "load" });
  const policy = res!.headers()["content-security-policy"];
  expect(policy, `enforced CSP on ${url}`).toBeTruthy();
  return policy!;
}

/** React attaches its fiber keys to elements only once the page's scripts have run. */
const hydrated = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        for (const el of document.querySelectorAll("a,button,input,main,header,div"))
          if (Object.keys(el).some((k) => k.startsWith("__react"))) return true;
        return false;
      }),
    )
    .toBe(true);

test.describe("D17-09 CSP, enforced", () => {
  test.setTimeout(180_000);

  test("prerendered pages and twins keep their scripts under the relaxed policy", async ({
    page,
  }) => {
    const csp = watchCsp(page);
    for (const path of [
      "/",
      "/products",
      `/products/${SLUG}`,
      "/contact",
      "/legal/terms",
      "/blog",
      "/services",
      "/no-such-page-d17",
    ]) {
      const policy = await visit(page, `${SITE}${path}`);
      expect(policy, path).toContain("'unsafe-inline'");
      expect(policy, path).not.toContain("'strict-dynamic'");
      await hydrated(page);
    }
    expect(csp).toEqual([]);
  });

  test("dynamic and token pages keep the strict nonce policy and still run", async ({ page }) => {
    const csp = watchCsp(page);
    for (const path of [
      "/auth/login",
      "/auth/register",
      "/search?q=resume",
      "/products?q=resume",
    ]) {
      const policy = await visit(page, `${SITE}${path}`);
      expect(policy, path).toContain("'strict-dynamic'");
      expect(policy, path).toMatch(/'nonce-/);
      await hydrated(page);
    }
    await page.context().addCookies([{ name: "ck_currency", value: "USD", url: SITE }]);
    for (const path of ["/", `/products/${SLUG}`]) {
      const policy = await visit(page, `${SITE}${path}`);
      expect(policy, `${path} with cookie`).toContain("'strict-dynamic'");
      await hydrated(page);
    }
    expect(csp).toEqual([]);
  });

  test("admin stays strict and runs", async ({ page }) => {
    const csp = watchCsp(page);
    await loginAs(page, "super_admin");
    for (const path of ["/admin", "/admin/quotes"]) {
      const policy = await visit(page, `${ADMIN}${path}`);
      expect(policy, path).toContain("'strict-dynamic'");
      await hydrated(page);
    }
    expect(csp).toEqual([]);
  });
});

test.describe("D17-03 quote email preview", () => {
  test.setTimeout(120_000);

  test("follows the live form, including tax and blank input", async ({ page }) => {
    await loginAs(page, "super_admin");
    await page.goto(`${ADMIN}/admin/quotes`);
    await page.getByRole("button", { name: "New quote" }).first().click();
    const preview = page.getByRole("heading", { name: "Email preview" }).locator("..");
    await page.locator('input[name="title"]').fill("Website build");
    const amount = page.locator('input[name="amount"]');
    await amount.fill("575");
    await expect(preview).toContainText("Website build");
    await expect(preview).toContainText("575.00");
    await expect(preview).not.toContainText("₹0.00");
    await amount.fill("");
    await expect(preview).toContainText("—");
  });
});

test.describe("D17-06 email preview", () => {
  test.setTimeout(120_000);

  test("every template renders and fits a phone", async ({ page, browser }) => {
    await loginAs(page, "super_admin");
    await page.goto(`${ADMIN}/admin/email-preview`);
    const frames = page.locator("iframe");
    await expect(frames.first()).toBeVisible();
    const count = await frames.count();
    expect(count).toBeGreaterThan(8);
    const phone = await browser.newPage({ viewport: { width: 375, height: 800 } });
    for (let i = 0; i < count; i++) {
      await phone.setContent((await frames.nth(i).getAttribute("srcdoc")) ?? "");
      const width = await phone.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `template ${i} fits 375 px`).toBeLessThanOrEqual(375);
      await expect(phone.locator("body")).not.toContainText(/undefined|NaN/);
    }
    await phone.close();
  });
});

test.describe("D17-05 invoice print", () => {
  test.setTimeout(120_000);

  test("dark theme prints white text on the accent and dark text elsewhere", async ({ page }) => {
    const [buyer] = await q<{ id: string }>(
      `select id from users where email='buyer@codekraft.test'`,
    );
    const tag = String(Date.now());
    const snap = JSON.stringify({ name: "Buyer", email: "buyer@codekraft.test", country: "IN" });
    const [order] = await q<{ id: string }>(
      `insert into orders (order_no, user_id, status, currency, subtotal_minor, discount_minor, tax_minor,
         total_minor, billing_snapshot, fx_rate_to_inr, paid_at)
       values ($1,$2,'paid','INR',10000,0,1800,11800,$3::jsonb,1,now()) returning id`,
      [`D17-${tag}`, buyer!.id, snap],
    );
    const seller = JSON.stringify({
      name: "Crestline Technologies",
      address: "1 Road, Bengaluru",
      gst_number: "29AAAAA0000A1Z5",
      email: "billing@example.test",
      state_code: "29",
    });
    const lines = JSON.stringify([
      {
        description: "Website build",
        quantity: 1,
        unit_minor: 10000,
        discount_minor: 0,
        tax_minor: 1800,
        total_minor: 11800,
      },
    ]);
    const [inv] = await q<{ id: string }>(
      `insert into invoices (invoice_no, order_id, fy, seq, seller_snapshot, buyer_snapshot, lines,
         subtotal_minor, discount_minor, tax_minor, total_minor, currency)
       values ($1,$2,'2026-27',900100,$3::jsonb,$4::jsonb,$5::jsonb,10000,0,1800,11800,'INR') returning id`,
      [`CK/D17/${tag}`, order!.id, seller, snap, lines],
    );
    await loginAs(page, "customer");
    await page.emulateMedia({ colorScheme: "dark", media: "print" });
    await page.goto(`${SITE}/account/invoices/${inv!.id}`);
    const invoice = page.locator(".ck-invoice");
    await expect(invoice).toBeVisible();
    await expect(invoice).toContainText("INR");
    const color = (sel: string) =>
      invoice
        .locator(sel)
        .first()
        .evaluate((el) => getComputedStyle(el).color);
    expect(await color(".ck-on-accent th")).toBe("rgb(255, 255, 255)");
    expect(await color("td")).toBe("rgb(0, 0, 0)");
  });
});
