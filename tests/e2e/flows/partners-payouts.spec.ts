/**
 * Partners + payouts end to end (P9-04): admin adds a partner, an allocation exists after a paid
 * order, a payout is requested and approved by the other super admin, the partner balance drops by
 * exactly the payout, and the ledger shows the payout as a debit.
 *
 * Requires the local seed (both super admins, SEED_ADMIN_EMAILS) and at least one paid order so an
 * allocation exists -- run commerce/purchase-path.spec.ts first (its "g. admin confirms the payment"
 * step is the sale fixture). The test skips, rather than fails, when no allocation exists yet.
 * Needs a dev server + DB; type-checked in CI, run on Mac A.
 */
import { expect, test, type Page } from "@playwright/test";

const ADMIN = "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const CEO = "yashbank2002@gmail.com";
const CFO = "sanketshrikant42@gmail.com";
const PAYOUT_MAJOR = 1; // ₹1.00 keeps the payout under any seeded balance
const slow = expect.configure({ timeout: 30_000 });

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto(`${ADMIN}/auth/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

/** Balance in rupees from the first partner card's `aria-label="₹1,234.00 INR"` figure. */
async function firstPartnerBalance(page: Page): Promise<{ name: string; balance: number }> {
  await page.goto(`${ADMIN}/admin/finance/partners`);
  const card = page.locator('section[aria-label$=" balance"]').first();
  await slow(card, "a partner card").toBeVisible();
  const name = ((await card.getAttribute("aria-label")) ?? "").replace(/ balance$/, "");
  const label =
    (await card.locator('[aria-label$=" INR"]').first().getAttribute("aria-label")) ?? "";
  return { name, balance: Number.parseFloat(label.replace(/[^0-9.]/g, "")) };
}

test("add partner, allocation after a sale, payout approved, balance drops, ledger debit", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const ceoCtx = await browser.newContext();
  const cfoCtx = await browser.newContext();
  const ceo = await ceoCtx.newPage();
  const cfo = await cfoCtx.newPage();
  try {
    await signIn(ceo, CEO);

    // 1. Make sure the CFO is a partner (idempotent: a duplicate just toasts an error).
    await ceo.goto(`${ADMIN}/admin/finance/partners`);
    await ceo.getByRole("button", { name: "Add partner" }).first().click();
    const add = ceo.getByRole("dialog");
    await add.getByLabel(/Admin email/).fill(CFO);
    await add.getByRole("button", { name: "Add partner" }).click();
    await ceo.keyboard.press("Escape");

    // 2. Sale fixture: an allocation row exists and the partner has a balance to pay out.
    await ceo.goto(`${ADMIN}/admin/finance/allocations`);
    const allocationRows = ceo.getByRole("table").locator("tbody tr");
    test.skip((await allocationRows.count()) === 0, "no paid order yet: run purchase-path first");
    const before = await firstPartnerBalance(ceo);
    test.skip(before.balance <= PAYOUT_MAJOR, "partner balance too small for the payout");

    // 3. CEO requests a payout for that partner.
    const reference = `E2E-UTR-${Date.now()}`;
    await ceo
      .locator(`section[aria-label="${before.name} balance"]`)
      .getByRole("button", { name: "Record payout" })
      .click();
    const dlg = ceo.getByRole("dialog");
    await dlg.locator("#po-amount").fill(String(PAYOUT_MAJOR));
    await dlg.locator("#po-ref").fill(reference);
    await dlg.getByRole("button", { name: "Request approval" }).click();
    await slow(ceo.getByText("Payout sent for approval")).toBeVisible();

    // 4. The other super admin approves it (requester cannot approve their own request).
    await signIn(cfo, CFO);
    await cfo.goto(`${ADMIN}/admin/approvals`);
    await cfo
      .getByText(/payout/i)
      .first()
      .click();
    await cfo.getByRole("button", { name: /^approve /i }).click();
    await slow(cfo.getByText("Approved").first()).toBeVisible();

    // 5. Balance decreased by exactly the payout.
    const after = await firstPartnerBalance(ceo);
    expect(after.name).toBe(before.name);
    expect(after.balance).toBeCloseTo(before.balance - PAYOUT_MAJOR, 2);

    // 6. The ledger shows the payout as a debit (also exercises the ?type= URL filter).
    await ceo.goto(`${ADMIN}/admin/finance/ledger?type=payout`);
    const row = ceo.getByRole("table").locator("tbody tr").first();
    await slow(row).toContainText("Payout");
    await expect(row).toContainText(/₹\s?1\.00/);
    await expect(ceo.getByRole("combobox", { name: "Entry type" })).toContainText(/payout/i);
  } finally {
    await ceoCtx.close();
    await cfoCtx.close();
  }
});
