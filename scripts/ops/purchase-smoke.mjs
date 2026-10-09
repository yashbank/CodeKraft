#!/usr/bin/env node
/* global process, console */
/**
 * Production purchase-path smoke: register customer, checkout, admin verifies email, place order,
 * submit payment reference, admin sees order. Never confirms payment while STOP_BEFORE_CONFIRM=1.
 * Env: SITE_URL ADMIN_URL ADMIN_EMAIL ADMIN_PASSWORD PRODUCT_SLUG CUSTOMER_PASSWORD
 *      [CUSTOMER_EMAIL] [STOP_BEFORE_CONFIRM=1] [SHOTS_DIR=./.scratch-e2e/purchase-<ts>]
 * Signs in once per role and signs both out at the end. Each run creates a new customer.
 */
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const SITE = need("SITE_URL").replace(/\/$/, "");
const ADMIN = need("ADMIN_URL").replace(/\/$/, "");
const SLUG = need("PRODUCT_SLUG");
const PW = need("CUSTOMER_PASSWORD");
const ts = Date.now();
const EMAIL = process.env.CUSTOMER_EMAIL ?? `ck-prod-smoke-${ts}@example.com`;
const STOP = (process.env.STOP_BEFORE_CONFIRM ?? "1") === "1";
const SHOTS = process.env.SHOTS_DIR ?? `./.scratch-e2e/purchase-${ts}`;
mkdirSync(SHOTS, { recursive: true });

const T = 60_000;
expect.configure({ timeout: T });
const browser = await chromium.launch();
const pages = {};
let n = 0;

async function newPage(label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  page.issues = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/.test(m.text() + (m.location().url ?? "")))
      page.issues.push(`console: ${m.text()} @ ${m.location().url ?? ""}`);
  });
  page.on("pageerror", (e) => page.issues.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    if (!/favicon/.test(r.url()))
      page.issues.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url()))
      page.issues.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  pages[label] = page;
  return page;
}
async function step(num, name, page, fn) {
  n = num;
  const shot = (s) =>
    page.screenshot({ path: `${SHOTS}/${String(n).padStart(2, "0")}-${s}.png`, fullPage: true });
  try {
    const detail = await fn();
    await shot(name);
    console.log(`STEP ${num} OK ${detail ?? ""}`);
  } catch (e) {
    await shot(`${name}-FAIL`).catch(() => {});
    console.log(`STEP ${num} FAIL ${String(e.message).split("\n")[0]}`);
    throw e;
  }
}
const idle = (p) => p.waitForLoadState("networkidle");

let failed = false;
let offeringId = "";
let customerId = "";
let orderNo = "";
let orderId = "";
try {
  const site = await newPage("site");
  const admin = await newPage("admin");

  await step(1, "register-signin", site, async () => {
    const res = await site.request.post(`${SITE}/api/auth/sign-up/email`, {
      headers: { origin: SITE },
      data: { email: EMAIL, password: PW, name: "CK Prod Smoke" },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await site.goto(`${SITE}/auth/login`);
    await idle(site);
    await site.getByLabel("Email").fill(EMAIL);
    await site.getByLabel("Password").fill(PW);
    await site.getByRole("button", { name: "Sign in" }).click();
    await expect(site).toHaveURL(/\/account$/);
    return `${EMAIL} -> ${site.url()}`;
  });

  await step(2, "product-checkout", site, async () => {
    await site.goto(`${SITE}/products/${SLUG}`);
    await idle(site);
    const h1 = site.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    const name = await h1.innerText();
    await expect(site.getByText(/₹\s?[\d,]+/).first()).toBeVisible();
    const price = await site
      .getByText(/₹\s?[\d,]+/)
      .first()
      .innerText();
    const buy = site.getByRole("link", { name: /buy now/i }).first();
    const href = decodeURIComponent(await buy.getAttribute("href"));
    // Product page can render signed-out CTA (-> /auth/login?returnTo=...offering=<id>) even with a session.
    const m = href.match(/\/checkout\/([^/?&]+)/) ?? href.match(/offering=([^&]+)/);
    offeringId = m[1];
    if (!href.includes("/checkout/")) console.log(`NOTE buy link signed-out variant: ${href}`);
    await site.goto(`${SITE}/checkout/${offeringId}`);
    await expect(site).toHaveURL(/\/checkout\/[^/?]+/);
    await expect(site.getByText("Verify your email to continue")).toBeVisible();
    return `"${name}" ${price}; offering ${offeringId}; verify banner shown`;
  });

  await step(3, "admin-verify", admin, async () => {
    await admin.goto(`${ADMIN}/auth/login`);
    await idle(admin);
    await admin.getByLabel("Email").fill(need("ADMIN_EMAIL"));
    await admin.getByLabel("Password", { exact: true }).fill(need("ADMIN_PASSWORD"));
    await admin.getByRole("button", { name: "Sign in", exact: true }).click();
    await admin.waitForURL((u) => !u.pathname.includes("/login"));
    await idle(admin);
    await admin.goto(`${ADMIN}/admin/customers`);
    await admin.getByPlaceholder("Name, email, company…").fill(EMAIL);
    await admin.keyboard.press("Enter");
    const row = admin.locator('a[href*="/admin/customers/"]').filter({ hasText: EMAIL }).first();
    let via = "search";
    if (await row.isVisible({ timeout: 15_000 }).catch(() => false)) {
      customerId = (await row.getAttribute("href")).split("/").pop();
      await row.click();
    } else {
      via = "list-link-fallback";
      const any = admin.locator(`a[href*="/admin/customers/"]`).filter({ hasText: EMAIL }).first();
      await expect(any, "customer not found in list").toBeVisible();
      customerId = (await any.getAttribute("href")).split("/").pop();
      await admin.goto(`${ADMIN}/admin/customers/${customerId}`);
    }
    await admin.getByRole("button", { name: "Mark email verified" }).click();
    await expect(admin.getByText(/marked as verified/).first()).toBeVisible();
    return `customer ${customerId} verified via ${via}`;
  });

  await step(4, "place-order", site, async () => {
    await site.goto(`${SITE}/checkout/${offeringId}`);
    await idle(site);
    const place = site.getByRole("button", { name: /Place order/ });
    await expect(place).toBeVisible();
    const terms = site.getByLabel(/I agree/i);
    if (await terms.count()) await terms.check();
    await place.click();
    const banner = site
      .getByRole("status")
      .getByText(/Order .+ placed/)
      .first();
    await expect(banner).toBeVisible();
    orderNo = (await banner.innerText()).match(/Order (\S+) placed/)[1];
    await expect(site.getByText(/Pay via UPI|Bank transfer|Pay via bank/i).first()).toBeVisible();
    return `order ${orderNo}`;
  });

  await step(5, "payment-reference", site, async () => {
    await site.getByLabel(/Transfer reference/).fill(`PRODSMOKE-${ts}`);
    await site.getByRole("button", { name: /submit reference/i }).click();
    await expect(site.getByText("Reference submitted — awaiting confirmation")).toBeVisible();
    await site.goto(`${SITE}/account/orders`);
    await expect(site).toHaveURL(/\/account\/purchases/);
    await site.goto(`${SITE}/account/orders/${orderNo}`);
    await expect(site.getByText(orderNo).first()).toBeVisible();
    await expect(site.getByText(/pending|awaiting/i).first()).toBeVisible();
    return "reference submitted; order pending/awaiting";
  });

  await step(6, "admin-order", admin, async () => {
    await admin.goto(`${ADMIN}/admin/orders`);
    await idle(admin);
    const link = admin.locator('a[href*="/admin/orders/"]').filter({ hasText: orderNo }).first();
    await expect(link, "order not in admin list").toBeVisible();
    orderId = (await link.getAttribute("href")).split("/").pop();
    await link.click();
    await expect(admin.getByRole("button", { name: "Confirm payment" }).first()).toBeVisible();
    await expect(admin.getByText(`PRODSMOKE-${ts}`).first()).toBeVisible();
    if (!STOP) throw new Error("STOP_BEFORE_CONFIRM=0 is not implemented; refusing to confirm");
    return `STOPPED BEFORE CONFIRM order=${orderNo} orderId=${orderId} customer=${EMAIL}`;
  });
} catch {
  failed = true;
} finally {
  for (const [label, p] of Object.entries(pages)) {
    console.log(
      `issues ${label}: ${p.issues.length ? "\n  " + [...new Set(p.issues)].join("\n  ") : "none"}`,
    );
    try {
      if (label === "admin") {
        await p.goto(`${ADMIN}/admin`);
        await idle(p);
        await p.getByRole("button", { name: /Account menu for/ }).click({ timeout: 15_000 });
        await p.getByRole("menuitem", { name: /Sign out/ }).click();
      } else {
        const r = await p.request.post(`${SITE}/api/auth/sign-out`, {
          headers: { origin: SITE },
          data: {},
        });
        expect(r.ok(), `sign-out HTTP ${r.status()}`).toBeTruthy();
      }
      await idle(p);
      console.log(`signed out ${label}`);
    } catch (e) {
      console.log(`sign-out ${label} failed: ${String(e.message).split("\n")[0]}`);
    }
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
