/**
 * R9-03: order + fulfilment status per delivery type. Seeds a submitted manual payment through
 * q(), confirms it in the admin UI (the real grant path), then checks the admin order page (status
 * + next-step action) and the customer's delivery panel. Local DB + production build only.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, SITE, atWidths, expectNoOverflow, loginAs, q } from "./helpers";

type Row = Record<string, string>;
const tag = Date.now().toString(36);

async function seedSubmittedOrder(
  deliveryType: string,
): Promise<{ orderId: string; offeringId: string }> {
  const [prod] = await q<Row>(`select id from products order by created_at limit 1`);
  const [buyer] = await q<Row>(`select id, email from users where email='buyer@codekraft.test'`);
  const [off] = await q<Row>(
    `insert into offerings (product_id, name, slug, purchase_model, delivery_type, delivery_config, status)
     values ($1, $2, $3, 'one_time', $4, '{"provisioning":"manual"}'::jsonb, 'active') returning id`,
    [prod!.id, `R903 ${deliveryType}`, `r903-${deliveryType}-${tag}`, deliveryType],
  );
  await q(
    `insert into offering_prices (offering_id, currency, amount_minor) values ($1,'INR',100000)`,
    [off!.id],
  );
  const [o] = await q<Row>(
    `insert into orders (order_no, type, user_id, status, currency, subtotal_minor, total_minor,
       billing_snapshot, fx_rate_to_inr, expires_at)
     values ($1,'product',$2,'pending_payment','INR',100000,100000,$3::jsonb,1, now() + interval '7 days')
     returning id`,
    [
      `R903-${deliveryType}-${tag}`.toUpperCase(),
      buyer!.id,
      JSON.stringify({ name: "Buyer", email: buyer!.email, country: "IN" }),
    ],
  );
  await q(
    `insert into order_items (order_id, offering_id, product_id, description, unit_minor, total_minor)
     values ($1,$2,$3,$4,100000,100000)`,
    [o!.id, off!.id, prod!.id, `R903 ${deliveryType}`],
  );
  await q(
    `insert into payments (order_id, provider, status, amount_due_minor, currency, customer_reference, customer_submitted_at)
     values ($1,'manual_upi','submitted',100000,'INR','R903UTR${tag}', now())`,
    [o!.id],
  );
  return { orderId: o!.id!, offeringId: off!.id! };
}

async function adminConfirm(page: Page, orderId: string): Promise<void> {
  await page.goto(`${ADMIN}/admin/orders/${orderId}`);
  await page.getByRole("button", { name: "Confirm payment" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("#cp-ref").fill(`R903UTR${tag}`);
  await dlg.locator("#cp-verified").click();
  await dlg.getByRole("button", { name: "Confirm and mark Paid" }).click();
  await expect(page.getByText(/Paid|Fulfilled/).first()).toBeVisible({ timeout: 40_000 });
}

const orderStatus = async (orderId: string) =>
  (await q<Row>(`select status from orders where id=$1`, [orderId]))[0]?.status;
async function entitlementId(orderId: string): Promise<string> {
  const [e] = await q<Row>(
    `select e.id from entitlements e join order_items i on i.id=e.order_item_id where i.order_id=$1`,
    [orderId],
  );
  return e!.id!;
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("R9-03 fulfilment per delivery type", () => {
  let admin: Page;
  let cust: Page;
  test.beforeAll(async ({ browser }) => {
    // Admin order/settings screens are laptop-only; keep the admin side desktop in the mobile project.
    admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    cust = await (await browser.newContext()).newPage();
    await loginAs(admin, "super_admin");
    await loginAs(cust, "customer");
  });
  test.afterAll(async () => {
    await admin.context().close();
    await cust.context().close();
  });

  test("download: fulfilled on payment, customer sees files panel", async () => {
    const { orderId } = await seedSubmittedOrder("download");
    await adminConfirm(admin, orderId);
    await expect.poll(() => orderStatus(orderId)).toBe("fulfilled");
    await admin.reload();
    await expect(admin.getByText("Fulfilled").first()).toBeVisible();
    await expect(admin.getByRole("button", { name: "Reset count" })).toBeVisible();
    await cust.goto(`${SITE}/account/purchases/${await entitlementId(orderId)}`);
    await expect(cust.getByRole("heading", { name: "Files" })).toBeVisible();
    await expect(cust.getByText("Active").first()).toBeVisible();
  });

  test("licence key (manual): paid until admin saves a key, then fulfilled", async () => {
    const { orderId } = await seedSubmittedOrder("license");
    await adminConfirm(admin, orderId);
    expect(await orderStatus(orderId)).toBe("paid");
    await expect(admin.getByLabel("License key")).toBeVisible();
    const entId = await entitlementId(orderId);
    await cust.goto(`${SITE}/account/purchases/${entId}`);
    await expect(cust.getByText(/Being prepared/)).toBeVisible();
    await admin.getByLabel("License key").fill("R903-TEST-KEY-0001");
    await admin.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => orderStatus(orderId), { timeout: 30_000 }).toBe("fulfilled");
    await cust.reload();
    await expect(cust.getByRole("heading", { name: "License key" })).toBeVisible();
    await expect(cust.getByText(/•••• 0001/)).toBeVisible();
  });

  for (const type of ["hosted", "custom"] as const) {
    test(`${type}: paid + Provisioning until admin marks delivered, then fulfilled`, async () => {
      const { orderId } = await seedSubmittedOrder(type);
      await adminConfirm(admin, orderId);
      expect(await orderStatus(orderId)).toBe("paid");
      const entId = await entitlementId(orderId);
      const mark = admin.getByRole("button", { name: "Mark delivered" }).first();
      await expect(mark).toBeEnabled();
      await cust.goto(`${SITE}/account/purchases/${entId}`);
      // Hosted shows "Being set up"; custom has no panel copy beyond its heading + Pending chip.
      if (type === "hosted") await expect(cust.getByText(/Being set up/).first()).toBeVisible();
      else {
        await expect(cust.getByRole("heading", { name: "Custom delivery" })).toBeVisible();
        await expect(cust.getByText("Pending").first()).toBeVisible();
      }
      await mark.click();
      await expect.poll(() => orderStatus(orderId), { timeout: 30_000 }).toBe("fulfilled");
      await cust.reload();
      await expect(cust.getByText("Active").first()).toBeVisible();
      if (type === "hosted")
        await expect(cust.getByRole("heading", { name: "Ready" })).toBeVisible();
      await expect(cust.getByText(/Being set up/)).toHaveCount(0);
    });
  }

  test("Fulfilment guide in Settings renders at 375/768/1280", async () => {
    await atWidths(admin, `${ADMIN}/admin/settings`, async (w) => {
      // Admin settings is laptop-only (<1024px shows a notice instead of the screen).
      if (w < 1024) {
        await expect(admin.getByText(/designed for laptops/)).toBeVisible();
        return;
      }
      await admin.getByRole("button", { name: "Fulfilment guide" }).click();
      const guide = admin.getByTestId("fulfilment-guide");
      await expect(guide).toBeVisible();
      await expectNoOverflow(admin);
      for (const t of [
        "Download",
        "Licence key",
        "Hosted website",
        "SaaS",
        "Custom",
        "Subscriptions",
      ])
        await expect(guide.getByRole("heading", { name: t })).toBeVisible();
    });
  });
});
