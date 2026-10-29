/**
 * R9-06: "Confirming your payment" after a manual UPI proof submit -> redirect to invoices ->
 * admin marks paid -> customer sees the delivery action. Checked at 375/768/1280.
 */
import { expect, test } from "@playwright/test";
import { ADMIN, SITE, WIDTHS, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

const VPA = "r906shop@okhdfcbank";
const QR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("r9-06 confirming screen, redirect, delivery action", async ({ browser }) => {
  test.setTimeout(240_000);
  const adminCtx = await browser.newContext();
  const custCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const cust = await custCtx.newPage();
  const issues = trackIssues(cust, [/razorpay/i]);

  // An active one-time offering the buyer does not own yet.
  const [off] = await q<{ oid: string; dt: string | null }>(
    `select o.id as oid, o.delivery_type as dt from offerings o join products p on p.id=o.product_id
     where o.status='active' and o.purchase_model='one_time' and p.status='published'
       and not exists (select 1 from user_offering_purchases u where u.offering_id=o.id
         and u.user_id=(select id from users where email='buyer@codekraft.test'))
     order by o.created_at limit 1`,
  );
  expect(off, "an unowned one-time offering").toBeTruthy();

  await test.step("admin enables UPI payment details", async () => {
    await loginAs(admin, "super_admin");
    await admin.goto(`${ADMIN}/admin/settings`);
    await admin.getByRole("button", { name: "Payment methods" }).click();
    const mps = admin.getByTestId("manual-payment-settings");
    await expect(mps).toBeVisible();
    const upi = mps.locator("#st-upi");
    if ((await upi.getAttribute("aria-checked")) !== "true") await upi.click();
    // Bank transfer on with empty details blocks the save; this test only needs UPI.
    const bank = mps.locator("#st-bank");
    if ((await bank.getAttribute("aria-checked")) === "true") await bank.click();
    await mps.locator("#st-vpa").fill(VPA);
    await mps.locator("#st-payee").fill("R906 Payee Pvt Ltd");
    await mps
      .locator("#st-qr")
      .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: QR_PNG });
    await admin.getByRole("button", { name: "Save payment details" }).click();
    await expect(admin.getByText(/Payment details saved|requested/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  await loginAs(cust, "customer");
  await cust.goto(`${SITE}/checkout/${off!.oid}`);
  const upiRadio = cust.getByRole("radio", { name: /UPI/ }).first();
  if (await upiRadio.count()) await upiRadio.check().catch(() => undefined);
  await cust
    .getByRole("checkbox", { name: /license terms|I agree|accept/i })
    .first()
    .check();
  await cust.getByRole("button", { name: /Place order/ }).click();
  await expect(cust.getByRole("heading", { name: /Pay via UPI/ })).toBeVisible({ timeout: 30_000 });
  const [o] = await q<{ id: string; n: string }>(
    `select id, order_no as n from orders where user_id=(select id from users where email='buyer@codekraft.test') order by created_at desc limit 1`,
  );

  await test.step("submit proof -> Confirming your payment -> invoices", async () => {
    await cust.locator("#pay-ref").fill("R906UTR123456789");
    await cust.getByRole("button", { name: /I've paid/ }).click();
    await expect(cust.getByRole("heading", { name: "Confirming your payment" })).toBeVisible({
      timeout: 40_000,
    });
    await expect(cust.getByRole("status")).toContainText(/Pending verification/i);
    await expect(cust).toHaveURL(/\/account\/invoices/, { timeout: 15_000 });
  });

  await test.step("confirming screen at 375/768/1280, no error page", async () => {
    for (const w of WIDTHS) {
      await cust.setViewportSize({ width: w, height: 900 });
      await cust.goto(`${SITE}/checkout/confirming/${o!.n}`);
      await expect(cust.getByRole("heading", { name: "Confirming your payment" })).toBeVisible();
      await expect(cust.getByRole("button", { name: "Refresh" })).toBeVisible();
      await expectNoOverflow(cust);
    }
    // Reloading the old checkout URL must not 404 / bounce to the product page.
    await cust.goto(`${SITE}/checkout/${off!.oid}`);
    await expect(cust).toHaveURL(/\/(checkout\/confirming|account\/invoices)/, { timeout: 15_000 });
  });

  await test.step("admin marks paid -> customer sees delivery action", async () => {
    await admin.goto(`${ADMIN}/admin/orders/${o!.id}`);
    await admin.getByRole("button", { name: "Confirm payment" }).first().click();
    const dlg = admin.getByRole("dialog");
    await dlg.locator("#cp-ref").fill("R906UTR123456789");
    await dlg.locator("#cp-verified").click();
    await dlg.getByRole("button", { name: "Confirm and mark Paid" }).click();
    await expect(admin.getByText(/Paid/).first()).toBeVisible({ timeout: 40_000 });

    await cust.setViewportSize({ width: 1280, height: 900 });
    await cust.goto(`${SITE}/checkout/confirming/${o!.n}`);
    const label =
      off!.dt === "download"
        ? "Download"
        : off!.dt === "license"
          ? "Reveal licence key"
          : "View delivery steps";
    await expect(cust.getByRole("status")).toContainText(/Paid/i);
    await expect(cust.getByRole("link", { name: label })).toBeVisible({ timeout: 15_000 });
  });

  issues.assertClean();
  await adminCtx.close();
  await custCtx.close();
});
