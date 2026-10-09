#!/usr/bin/env node
/* global process, console */
/**
 * Publishes a draft product through the two-admin approval flow (ownership, then publish).
 * Env: ADMIN_URL SITE_URL ADMIN1_EMAIL ADMIN1_PASSWORD ADMIN2_EMAIL ADMIN2_PASSWORD PRODUCT_ID
 *      [OWNERSHIP=company] [SHOTS_DIR=./.scratch-e2e/publish-<ts>]
 * Logs in once per admin (login is rate limited) and signs both out at the end.
 */
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const ADMIN_URL = need("ADMIN_URL").replace(/\/$/, "");
const SITE_URL = need("SITE_URL").replace(/\/$/, "");
const PRODUCT_ID = need("PRODUCT_ID");
const OWNERSHIP = process.env.OWNERSHIP ?? "company";
const SHOTS = process.env.SHOTS_DIR ?? `./.scratch-e2e/publish-${Date.now()}`;
if (OWNERSHIP !== "company") throw new Error("Only OWNERSHIP=company is supported");
mkdirSync(SHOTS, { recursive: true });

const T = 60_000;
expect.configure({ timeout: T });
const browser = await chromium.launch();
const open = [];
let n = 0;
let page1;
let page2;

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);
  page.consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && page.consoleErrors.push(m.text()));
  open.push(page);
  return page;
}
async function shot(page, name) {
  await page.screenshot({
    path: `${SHOTS}/${String(n).padStart(2, "0")}-${name}.png`,
    fullPage: true,
  });
}
const ok = (detail) => console.log(`STEP ${n} OK ${detail}`);
async function step(num, name, page, fn) {
  n = num;
  try {
    const detail = await fn();
    await shot(page, name);
    ok(detail ?? "");
  } catch (e) {
    await shot(page, `${name}-FAIL`).catch(() => {});
    console.log(`STEP ${num} FAIL ${String(e.message).split("\n")[0]}`);
    throw e;
  }
}
/** Waits for the next sonner toast and returns its text. */
async function toast(page) {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: T });
  const text = (await t.innerText()).replace(/\s+/g, " ");
  if (/failed|error/i.test(text) && !/applied|waiting|submitted/i.test(text))
    throw new Error(`toast: ${text}`);
  return text;
}
async function login(page, email, password) {
  await page.goto(`${ADMIN_URL}/auth/login`);
  await page.waitForLoadState("networkidle"); // React form: wait for hydration
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: T });
  await page.waitForLoadState("networkidle");
}
async function signOut(page) {
  await page.getByRole("button", { name: /Account menu for/ }).click({ timeout: 15_000 });
  await page.getByRole("menuitem", { name: /Sign out/ }).click();
  await page.waitForLoadState("networkidle");
}
async function openEditor(page) {
  await page.goto(`${ADMIN_URL}/admin/products/${PRODUCT_ID}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /^Basics/ }).click();
  await expect(page.locator("#p-name")).toBeVisible();
}
const tab = (page, label) => page.getByRole("tab", { name: new RegExp(`^${label}`) }).click();

/** Approves the pending item of this type whose detail pane names PRODUCT_ID; never touches others. */
async function approve(page, typeRe) {
  await page.goto(`${ADMIN_URL}/admin/approvals`);
  await page.waitForLoadState("networkidle");
  const items = page
    .getByRole("list", { name: "Approval requests" })
    .getByRole("listitem")
    .filter({ hasText: typeRe });
  await expect(items.first()).toBeVisible();
  const detail = page.locator("#approval-detail");
  for (let i = 0; i < (await items.count()); i++) {
    await items.nth(i).getByRole("button").click();
    if (!(await detail.innerText()).includes(PRODUCT_ID)) continue;
    await detail.getByRole("button", { name: /^Approve /, exact: false }).click();
    return toast(page);
  }
  throw new Error(`No pending ${typeRe} approval found for product ${PRODUCT_ID}`);
}

let ownershipPending = false;
let failed = false;
let name = "";
let slug = "";
try {
  page1 = await newPage();
  page2 = await newPage();

  await step(1, "admin1-login", page1, async () => {
    await login(page1, need("ADMIN1_EMAIL"), need("ADMIN1_PASSWORD"));
    return `signed in ${page1.url()}`;
  });

  await step(2, "offerings", page1, async () => {
    await openEditor(page1);
    name = await page1.locator("#p-name").inputValue();
    slug = await page1.locator("#p-slug").inputValue();
    await tab(page1, "Offerings");
    const rows = page1
      .getByRole("tabpanel")
      .getByRole("row")
      .filter({ hasNot: page1.getByRole("columnheader") });
    await expect(rows.first()).toBeVisible();
    const names = await rows.locator("td:first-child").allInnerTexts();
    return `product "${name}" slug ${slug}; offerings: ${names.join(", ")}`;
  });

  await step(3, "ownership", page1, async () => {
    await tab(page1, "Ownership");
    const panel = page1.getByRole("tabpanel");
    if (await panel.getByText(/Active split/).isVisible())
      return "active ownership exists, skipped";
    if (await panel.getByText("Proposal awaiting approval").isVisible()) {
      ownershipPending = true;
      return "ownership proposal already pending";
    }
    const direct = panel.getByRole("button", { name: "Propose company-owned (100%)" });
    if (await direct.isVisible()) await direct.click();
    else {
      // The editor offers the split form instead when partners exist; company-owned is its default.
      await panel.getByRole("button", { name: "Propose new split" }).click();
      await panel.getByRole("button", { name: "Request approval" }).click();
    }
    ownershipPending = true;
    return `toast: ${await toast(page1)}`;
  });

  await step(4, "admin2-approve-ownership", page2, async () => {
    await login(page2, need("ADMIN2_EMAIL"), need("ADMIN2_PASSWORD"));
    if (!ownershipPending) return "no pending ownership, skipped";
    return `toast: ${await approve(page2, /Ownership change/)}`;
  });

  await step(5, "submit-for-approval", page1, async () => {
    await openEditor(page1);
    await tab(page1, "Publish");
    await page1.getByRole("tabpanel").getByRole("button", { name: "Submit for approval" }).click();
    const t = await toast(page1).catch((e) => e);
    if (t instanceof Error) throw new Error(`Readiness/submit error: ${t.message}`);
    return `toast: ${t}`;
  });

  await step(6, "admin2-approve-publish", page2, async () => {
    return `toast: ${await approve(page2, /Publish/)}`;
  });

  await step(7, "storefront", page2, async () => {
    for (const path of ["/products", `/products/${slug}`]) {
      await page2.goto(`${SITE_URL}${path}`);
      await page2.waitForLoadState("networkidle");
      await expect(page2.getByText(name).first()).toBeVisible();
      await expect(page2.getByText(/₹|INR/).first()).toBeVisible();
      await shot(page2, `site${path.replace(/\W+/g, "-")}`);
    }
    const errs = page2.consoleErrors.filter(Boolean);
    console.log(`console errors: ${errs.length ? errs.join(" | ") : "none"}`);
    return `PUBLISHED ${slug}`;
  });
  console.log(`PUBLISHED ${slug}`);
} catch {
  failed = true;
} finally {
  for (const [p, label] of [
    [page1, "admin1"],
    [page2, "admin2"],
  ]) {
    if (!p) continue;
    try {
      await p.goto(`${ADMIN_URL}/admin`);
      await p.waitForLoadState("networkidle");
      await signOut(p);
      console.log(`signed out ${label}`);
    } catch (e) {
      console.log(`sign-out ${label} failed: ${String(e.message).split("\n")[0]}`);
    }
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
