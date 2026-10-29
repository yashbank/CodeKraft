/**
 * R9-10 finance: exact ledger debit/credit + running balance, every ledger filter, "My share" is
 * the signed-in admin's own partner, and a payout can be recorded. Local DB only (helpers.q).
 * The 40,000 credit is seeded into the ledger with SQL (there is no UI that posts a bare credit
 * without a paid order); the spend is recorded through the real Record-expense sheet.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, atWidths, formLogin, loginAs, q, trackIssues } from "./helpers";

const CFO = "sanketshrikant42@gmail.com";
const CEO = "yashbank2002@gmail.com";
const TAG = `R9-10-${Date.now().toString(36)}`;
const LEDGER = `${ADMIN}/admin/finance/ledger`;
const rows = (page: Page) => page.locator("table tbody tr").filter({ has: page.locator("td") });

async function partnerOf(email: string) {
  const [p] = await q<{ id: string; user_id: string; display_name: string }>(
    `select p.id, p.user_id, p.display_name from partners p join users u on u.id = p.user_id where u.email = $1`,
    [email],
  );
  if (!p) throw new Error(`no partner row for ${email}`);
  return p;
}

async function addEntry(
  type: string,
  party: string,
  partnerId: string | null,
  minor: number,
  memo: string,
  userId: string,
  ccy = "INR",
) {
  await q(
    `insert into ledger_entries (entry_type, party_type, partner_id, amount_minor, currency, fx_rate_to_inr, amount_inr_minor, memo, created_by)
     values ($1,$2,$3,$4,$5,'1',$4,$6,$7)`,
    [type, party, partnerId, minor, ccy, memo, userId],
  );
}

test.describe("R9-10 finance", () => {
  test.describe.configure({ mode: "serial" });
  // Finance screens render only a LaptopNotice below 1024px (docs/07 §3.4), so admin flows are desktop-only.
  test.skip(({ isMobile }) => isMobile, "admin finance is laptop-only (LaptopNotice below lg)");

  test("credit 40,000 then spend 2: exact debit/credit and running balance", async ({ page }) => {
    const issues = trackIssues(page);
    const ceo = await partnerOf(CEO);
    await addEntry("adjustment", "company", null, 4_000_000, `${TAG} credit`, ceo.user_id);

    await loginAs(page, "super_admin");
    await page.goto(`${ADMIN}/admin/finance/expenses`);
    await page
      .getByRole("button", { name: /Record expense/ })
      .first()
      .click();
    await page.locator("#ex-desc").fill(`${TAG} spend`);
    await page.locator("#ex-amount").fill("2");
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByText("Expense recorded")).toBeVisible();

    await page.goto(`${LEDGER}?q=${TAG}`);
    await expect(rows(page)).toHaveCount(2); // search narrows to exactly our two entries
    const [spend, credit] = [rows(page).nth(0), rows(page).nth(1)]; // newest first
    await expect(spend).toContainText(`${TAG} spend`);
    const sc = await spend.locator("td").allTextContents();
    const cc = await credit.locator("td").allTextContents();
    // columns: seq, date, type, entry, Debit, Credit, Balance
    expect(sc[4]).toMatch(/^₹\s?2\.00$/);
    expect(sc[5]).toBe("—");
    expect(sc[6]).toMatch(/39,998\.00/);
    expect(cc[4]).toBe("—");
    expect(cc[5]).toMatch(/^₹\s?40,000\.00$/);
    expect(cc[6]).toMatch(/40,000\.00/);
    issues.assertClean();
  });

  test("each ledger filter changes the rows correctly", async ({ page }) => {
    await loginAs(page, "super_admin");
    const ceo = await partnerOf(CEO);
    const base = `${LEDGER}?q=${TAG}`;
    const count = async (qs: string) => {
      await page.goto(`${base}${qs}`);
      await expect(page.getByRole("heading", { name: /Ledger/ }).first()).toBeVisible();
      return rows(page).count(); // empty state renders no table, so 0
    };
    const today = new Date().toISOString().slice(0, 10);
    expect(await count("")).toBe(2);
    expect(await count("&type=expense")).toBe(1);
    expect(await count("&type=adjustment")).toBe(1);
    expect(await count("&party=company")).toBe(2);
    expect(await count("&party=partner")).toBe(0);
    expect(await count(`&partner=${ceo.id}`)).toBe(0);
    expect(await count("&ccy=INR")).toBe(2);
    expect(await count("&ccy=USD")).toBe(0);
    expect(await count(`&from=${today}&to=${today}`)).toBe(2);
    expect(await count("&to=2000-01-01")).toBe(0);
    expect(await count("&from=2999-01-01")).toBe(0);
    // search: a word from the memo and a non-matching word
    await page.goto(`${LEDGER}`);
    await page.locator("#ledger-order").fill(`${TAG} spend`);
    await expect(page).toHaveURL(/q=/);
    await expect(rows(page)).toHaveCount(1);
    await page.locator("#ledger-order").fill("zzz-no-such-entry");
    await expect(page.getByText(/No (ledger )?entries|nothing/i).first()).toBeVisible();
  });

  test("My share is the signed-in admin's own partner (CEO vs CFO)", async ({ page, browser }) => {
    test.setTimeout(150_000); // two admin logins (auth limiter waits) plus the count-up settle
    const ceo = await partnerOf(CEO);
    const cfo = await partnerOf(CFO);
    await addEntry(
      "partner_allocation",
      "partner",
      ceo.id,
      1_111_100,
      `${TAG} ceo share`,
      ceo.user_id,
    );
    await addEntry(
      "partner_allocation",
      "partner",
      cfo.id,
      2_222_200,
      `${TAG} cfo share`,
      ceo.user_id,
    );

    // My share is not in the default dashboard layout: pin it for both admins.
    for (const u of [ceo.user_id, cfo.user_id])
      await q(
        `insert into dashboard_layouts (user_id, layout) values ($1, '["my_share"]'::jsonb)
         on conflict (user_id) do update set layout = excluded.layout`,
        [u],
      );
    const share = async (p: Page) => {
      await p.goto(`${ADMIN}/admin/dashboard`);
      const tile = p.getByText("Your allocations, net of refunds").locator("..");
      await expect(tile).toContainText("₹", { timeout: 30_000 });
      // the stat counts up from 0, so wait for the value to settle before reading it
      let last = "";
      await expect
        .poll(
          async () => {
            const t = (await tile.innerText()).replace(/[,\s]/g, "");
            const stable = t === last;
            last = t;
            return stable && !t.startsWith("₹0.00");
          },
          { timeout: 15_000, intervals: [700] },
        )
        .toBe(true);
      return last;
    };
    await loginAs(page, "super_admin");
    const ceoText = await share(page);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await formLogin(page2, ADMIN, CFO);
    const cfoText = await share(page2);
    await ctx2.close();

    const [ceoRow] = await q<{ s: string }>(
      `select coalesce(sum(amount_inr_minor),0) s from ledger_entries where partner_id=$1 and entry_type in ('partner_allocation','refund_partner_allocation')`,
      [ceo.id],
    );
    const [cfoRow] = await q<{ s: string }>(
      `select coalesce(sum(amount_inr_minor),0) s from ledger_entries where partner_id=$1 and entry_type in ('partner_allocation','refund_partner_allocation')`,
      [cfo.id],
    );
    const fmt = (m: string) => (Number(m) / 100).toFixed(2); // text above has commas stripped
    expect(ceoText).toContain(fmt(ceoRow!.s));
    expect(cfoText).toContain(fmt(cfoRow!.s));
    expect(ceoText).not.toEqual(cfoText);
  });

  test("record a payout for a partner", async ({ page }) => {
    const issues = trackIssues(page);
    const ceo = await partnerOf(CEO);
    await loginAs(page, "super_admin");
    await page.goto(`${ADMIN}/admin/finance/partners`);
    await page
      .getByRole("button", { name: /Record payout/ })
      .first()
      .click();
    await page.locator("#po-partner").click();
    await page.getByRole("option", { name: ceo.display_name }).click();
    await page.locator("#po-amount").fill("100");
    await page.locator('input[name="reference"]').fill(`${TAG}-UTR`);
    await page.getByRole("button", { name: "Request approval" }).last().click();
    await expect(page.getByText("Payout sent for approval")).toBeVisible();
    await page.getByRole("tab", { name: /Payouts/ }).click();
    await expect(page.getByText(`${TAG}-UTR`)).toBeVisible();
    issues.assertClean();
  });

  test("ledger renders at 375 / 768 / 1280 with the balance column", async ({ page }) => {
    await loginAs(page, "super_admin");
    await atWidths(page, `${LEDGER}?q=${TAG}`, async (w) => {
      if (w < 1024) {
        // below lg the admin shows only the "open on a laptop" notice (docs/07 §3.4)
        await expect(page.getByText(/designed for laptops/)).toBeVisible();
        return;
      }
      await expect(page.getByRole("columnheader", { name: "Balance" })).toBeAttached();
      await expect(rows(page).first()).toBeVisible();
    });
  });
});
