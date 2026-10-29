import { expect, test } from "@playwright/test";
import { ADMIN, SITE, atWidths, loginAs, q, trackIssues } from "./helpers";

const OLD_NAME = "Legacy Seller Pvt Ltd";
const NEW_NAME = `R9-02 Brand ${Date.now() % 100000}`;

test.describe("R9-02 invoices render from current settings", () => {
  test.setTimeout(240_000);

  test("rename in admin settings shows on an already-issued invoice (HTML + PDF + print)", async ({
    browser,
  }) => {
    const [buyer] = await q<{ id: string }>(
      `select id from users where email='buyer@codekraft.test'`,
    );
    const [sn] = await q<{ value: string }>(
      `select value from site_settings where key='site_name'`,
    );
    const originalName = String(sn?.value ?? "CodeKraft");
    const [sd] = await q<{ v: string }>(
      `select value::text as v from site_settings where key='seller_details'`,
    );
    const tag = String(Date.now());
    const buyerSnap = JSON.stringify({
      name: "Buyer",
      email: "buyer@codekraft.test",
      country: "IN",
    });
    const [order] = await q<{ id: string }>(
      `insert into orders (order_no, user_id, status, currency, subtotal_minor, discount_minor, tax_minor,
         total_minor, billing_snapshot, fx_rate_to_inr, paid_at)
       values ($1,$2,'paid','INR',10000,1000,1620,10620,$3::jsonb,1,now()) returning id`,
      [`R902-${tag}`, buyer!.id, buyerSnap],
    );
    const seller = JSON.stringify({
      name: OLD_NAME,
      address: "1 Old Road, Pune, 411001",
      gst_number: "27AAAAA0000A1Z5",
      email: "old@example.test",
      state_code: "MH",
    });
    const lines = JSON.stringify([
      {
        description: "R9 line",
        quantity: 1,
        unit_minor: 10000,
        discount_minor: 1000,
        tax_minor: 1620,
        total_minor: 10620,
      },
    ]);
    const [inv] = await q<{ id: string }>(
      `insert into invoices (invoice_no, order_id, fy, seq, seller_snapshot, buyer_snapshot, lines,
         subtotal_minor, discount_minor, tax_minor, total_minor, currency)
       values ($1,$2,'2026-27',900000,$3::jsonb,$4::jsonb,$5::jsonb,10000,1000,1620,10620,'INR') returning id`,
      [`CK/R902/${tag}`, order!.id, seller, buyerSnap, lines],
    );
    const url = `${SITE}/account/invoices/${inv!.id}`;
    const setRefresh = (on: boolean) =>
      q(
        `insert into site_settings (key, value) values ('refresh_old_invoices', $1::text::jsonb)
         on conflict (key) do update set value = excluded.value`,
        [JSON.stringify(on)],
      );

    // Admin settings is laptop-only (phones get a read-only notice), so the admin side is always desktop.
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const custCtx = await browser.newContext();
    const A = await adminCtx.newPage();
    const C = await custCtx.newPage();
    const issues = trackIssues(C);
    try {
      await setRefresh(true);
      await loginAs(A, "super_admin");
      await loginAs(C, "customer");

      // Change the business name through the admin UI.
      await A.goto(`${ADMIN}/admin/settings`);
      await expect(A.getByRole("button", { name: "Save changes" })).toBeEnabled({
        timeout: 60_000,
      });
      await A.locator("#st-site").fill(NEW_NAME);
      // The invoice seller name is the legal name (seller details), falling back to the site name.
      await A.locator("#st-legal").fill(NEW_NAME);
      await A.getByRole("button", { name: "Save changes" }).click();
      await expect(A.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });

      // ON: the old invoice shows the new name, in HTML and in the PDF download.
      await C.goto(url);
      await expect(C.getByTestId("invoice-seller-name")).toHaveText(NEW_NAME);
      const res = await C.request.get(`${url}/pdf`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("application/pdf");
      const pdf = await res.body();
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1")).toContain(NEW_NAME);

      // OFF: it keeps the stored snapshot.
      await setRefresh(false);
      await C.goto(url);
      await expect(C.getByTestId("invoice-seller-name")).toHaveText(OLD_NAME);
      await setRefresh(true);

      // Responsive HTML view.
      await atWidths(C, url, async () => {
        await expect(C.getByTestId("invoice-seller-name")).toBeVisible();
        await expect(C.getByText("Grand Total:")).toBeVisible();
      });

      // Print: site chrome hidden, invoice still visible.
      await C.setViewportSize({ width: 1280, height: 900 });
      await C.goto(url);
      await C.emulateMedia({ media: "print" });
      for (const nav of await C.locator("nav").all()) await expect(nav).toBeHidden();
      await expect(C.getByTestId("invoice-seller-name")).toBeVisible();
      issues.assertClean();
    } finally {
      await setRefresh(true);
      await q(`update site_settings set value = to_jsonb($1::text) where key='site_name'`, [
        originalName,
      ]);
      if (sd)
        await q(`update site_settings set value=$1::text::jsonb where key='seller_details'`, [sd.v]);
      await q(`delete from invoices where id=$1`, [inv!.id]).catch(() => undefined);
      await q(`delete from orders where id=$1`, [order!.id]).catch(() => undefined);
      await adminCtx.close();
      await custCtx.close();
    }
  });
});
