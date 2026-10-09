import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

// Dev server compiles each route on first hit.
const slow = expect.configure({ timeout: 60_000 });

const SITE = "http://localhost:3000";
const ADMIN = "http://admin.localhost:3000";
const PW = "e2e-passphrase-long-enough-9";
const ADMIN_EMAIL = "yashbank2002@gmail.com";
const ADMIN_PW = "local-super-admin-passphrase-2026";
const email = `e2e-buyer-${Date.now()}@example.com`;

let customer: Page;
let admin: Page;
let customerCtx: BrowserContext;
let adminCtx: BrowserContext;
let customerId = "";
let orderId = "";
let orderNo = "";
const errors: string[] = [];

const sql = () => postgres(process.env.DATABASE_URL!, { max: 1 });

function track(page: Page, label: string) {
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
}
const noPageErrors = () => slow(errors, "uncaught page errors").toEqual([]);

test.describe.configure({ mode: "serial", timeout: 300_000 });

test.describe("customer purchase path", () => {
  test.beforeAll(async ({ browser }) => {
    customerCtx = await browser.newContext({ baseURL: SITE });
    adminCtx = await browser.newContext({ baseURL: ADMIN });
    customer = await customerCtx.newPage();
    admin = await adminCtx.newPage();
    track(customer, "site");
    track(admin, "admin");
  });
  test.afterAll(async () => {
    await customerCtx.close();
    await adminCtx.close();
  });
  test.afterEach(noPageErrors);

  test("a. sign up via API and sign in", async () => {
    const res = await customerCtx.request.post(`${SITE}/api/auth/sign-up/email`, {
      headers: { origin: SITE },
      data: { email, password: PW, name: "E2E Buyer" },
    });
    slow(res.ok(), await res.text()).toBeTruthy();
    await customer.goto(`${SITE}/auth/login`);
    await customer.getByLabel("Email").fill(email);
    await customer.getByLabel("Password").fill(PW);
    await customer.getByRole("button", { name: "Sign in" }).click();
    await slow(customer, "lands on /account").toHaveURL(/\/account$/);
  });

  test("b. product page renders name and INR price", async () => {
    await customer.goto(`${SITE}/products/resume-portfolio-website`);
    await slow(customer.getByRole("heading", { level: 1 }), "product name").toContainText(
      /Resume/i,
    );
    await slow(customer.getByText(/₹\s?2,999/).first(), "INR price").toBeVisible();
  });

  test("c. unverified customer sees verify-email state at checkout", async () => {
    const db = sql();
    const [row] = await db`
      select o.id from offerings o join products p on p.id = o.product_id
      where p.slug = 'resume-portfolio-website' and o.slug = 'download'`;
    await db.end();
    slow(row, "seeded offering").toBeTruthy();
    (globalThis as { __offering?: string }).__offering = row!.id as string;
    await customer.goto(`${SITE}/checkout/${row!.id}`);
    await slow(
      customer.getByText("Verify your email to continue"),
      "verify-email banner",
    ).toBeVisible();
    await slow(customer.getByRole("button", { name: /Place order/ })).toHaveCount(0);
  });

  test("d. admin marks the customer email verified", async () => {
    const db = sql();
    const [u] = await db`select id from users where email = ${email}`;
    await db.end();
    customerId = u!.id as string;
    await admin.goto(`${ADMIN}/auth/login`);
    await admin.getByLabel("Email").fill(ADMIN_EMAIL);
    await admin.getByLabel("Password").fill(ADMIN_PW);
    await admin.getByRole("button", { name: "Sign in" }).click();
    await slow(admin, "admin signed in").not.toHaveURL(/\/auth\/login/);
    await admin.goto(`${ADMIN}/admin/customers`);
    await admin.getByPlaceholder("Name, email, company…").fill(email);
    await admin.keyboard.press("Enter");
    const row = admin.locator(`a[href$="/admin/customers/${customerId}"]`).first();
    if (await row.isVisible({ timeout: 15_000 }).catch(() => false)) await row.click();
    else await admin.goto(`${ADMIN}/admin/customers/${customerId}`); // list search not wired: direct fallback
    const btn = admin.getByRole("button", { name: "Mark email verified" });
    await btn.click();
    await slow(admin.getByText(/marked as verified/), "success toast").toBeVisible();
    await admin.reload();
    await slow(btn, "button gone after refresh").toHaveCount(0);
  });

  test("e. apply WELCOME10 and place order", async () => {
    const offering = (globalThis as { __offering?: string }).__offering;
    await customer.goto(`${SITE}/checkout/${offering}`);
    const placeBtn = customer.getByRole("button", { name: /Place order/ });
    await slow(placeBtn, "Place order offered once verified").toBeVisible();
    const before = await placeBtn.innerText();
    await customer.getByLabel("Coupon (optional)").fill("WELCOME10");
    await customer.getByRole("button", { name: "Apply" }).click();
    await slow(placeBtn, "total drops with coupon").not.toHaveText(before);
    await slow(placeBtn).toContainText(/₹\s?2,699/);
    await customer.getByLabel(/I agree/i).check();
    await placeBtn.click();
    const banner = customer.getByRole("status").getByText(/Order .+ placed/);
    await slow(banner, "payment instructions with order number").toBeVisible();
    orderNo = (await banner.first().innerText()).match(/Order (\S+) placed/)![1]!;
    await slow(customer.getByText(/Pay via UPI|Bank transfer|Pay via bank/i).first()).toBeVisible();
  });

  test("f. submit payment reference; order awaits confirmation", async () => {
    await customer.getByLabel(/Transfer reference/).fill("UTR123456789");
    await customer.getByRole("button", { name: /submit reference/ }).click();
    await slow(customer.getByText("Reference submitted — awaiting confirmation")).toBeVisible();
    const db = sql();
    const [o] = await db`select id from orders where order_no = ${orderNo}`;
    await db.end();
    orderId = o!.id as string;
    await customer.goto(`${SITE}/account/orders/${orderNo}`);
    await slow(customer.getByText(orderNo).first(), "order number shown").toBeVisible();
    await slow(customer.getByText(/pending|awaiting/i).first(), "pending status").toBeVisible();
  });

  test("g. admin confirms the payment", async () => {
    await admin.goto(`${ADMIN}/admin/orders/${orderId}`);
    await admin.getByRole("button", { name: "Confirm payment" }).first().click();
    const dlg = admin.getByRole("dialog");
    const due = await dlg.getByLabel(/Amount received/).inputValue();
    await dlg.getByLabel(/Amount received/).fill(due);
    await dlg.getByLabel("Reference (UTR / NEFT)").fill("UTR123456789");
    await dlg.getByLabel("Note").fill("e2e confirmation");
    await dlg.getByLabel(/I have verified this transfer/).check();
    await dlg.getByRole("button", { name: "Confirm and mark Paid" }).click();
    await slow(admin.getByText(/marked Paid/).first(), "success toast").toBeVisible();
    await slow(admin.getByText(/^(Paid|Fulfilled)$/).first(), "status Paid").toBeVisible();
  });

  test("h. purchases shows the entitlement and it opens", async () => {
    await customer.goto(`${SITE}/account/purchases`);
    await slow(customer.getByText("Couldn't load your purchases")).toHaveCount(0);
    const link = customer.locator('a[href^="/account/purchases/"]').first();
    await slow(link, "entitlement listed").toBeVisible();
    await link.click();
    await slow(customer, "detail page").toHaveURL(/\/account\/purchases\/.+/);
    await slow(customer.getByText(/Resume/i).first()).toBeVisible();
    await slow(customer.getByText(/download/i).first(), "download panel").toBeVisible();
  });
});
