/**
 * R8-15: deterministic two-browser Round 8 end-to-end flow. LOCAL ONLY (localhost DB + dev server).
 * Five isolated browser contexts: adminA, adminB (admin host), c1, c2, c3 (site host).
 * Each step records pass/fail and the run carries on, so one failure does not hide the rest;
 * the test fails at the end listing every failed step.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
const ADMIN = process.env.E2E_ADMIN_URL ?? "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const NEWPW = "E2e-Passw0rd!Round8";
const CEO = "yashbank2002@gmail.com";
const ADMIN2 = "e2e-admin2@codekraft.test";
const C1 = "e2e-c1@codekraft.test";
const C2 = "e2e-c2@codekraft.test";
const C3 = "e2e-c3@codekraft.test";
const PRODUCT_SLUG = "tradeflow";
const COUPON = "E2ER8";
const VPA = "e2er8shop@okhdfcbank";
const ACCT_NO = "50100123456789";
const IFSC = "HDFC0001234";
const NEW_SITE_NAME = "CodeKraft R8E2E";
// `\blocked\b`: the brief says /locked/, but that also hits the legit word "blocked".
const SWEEP_BAD = /BUG-\d+|R8-\d+|\blocked\b|depends on|lorem|dummy|TODO|V1\.1|coming soon/i;
// 1x1 PNG, used as the UPI QR upload (admin QR upload is the only QR source).
const QR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function loadDbUrl(): string {
  const file = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const m = /^DATABASE_URL=(.*)$/m.exec(file);
  const url = (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url))
    throw new Error("refusing: DATABASE_URL is not local");
  return url;
}

const sql = postgres(loadDbUrl(), { max: 2, prepare: false });
type Row = Record<string, unknown>;
const q = async (text: string, params: unknown[] = []): Promise<Row[]> =>
  (await sql.unsafe(text, params as never[])) as unknown as Row[];

// ---- issue tracking (console errors / 4xx / 5xx) ------------------------------------------------
const issues: string[] = [];
let expectedStatuses: number[] = [];
const livePages: Record<string, Page> = {};
function track(page: Page, label: string): void {
  livePages[label] = page;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return; // covered by the response tracker
    if (/Failed to fetch RSC payload/.test(t)) return; // dev worker restarting (network), not an app error
    issues.push(`[${label}] console.error: ${t.slice(0, 180)} @ ${page.url()}`);
  });
  page.on("pageerror", (e) => issues.push(`[${label}] pageerror: ${e.message.slice(0, 180)}`));
  page.on("response", (r) => {
    const s = r.status();
    if (s < 400 || expectedStatuses.includes(s)) return;
    const u = r.url();
    if (/favicon|\/_next\/webpack-hmr|__nextjs/.test(u)) return;
    // Seed logo objects (/api/files/public/seed/logos/*.svg) are not in local storage: env, not app.
    if (/\/api\/files\/public\/seed\/logos\//.test(u)) return;
    // Cover bytes: local storage cannot serve them here (see step 2, which asserts naturalWidth>0 explicitly).
    if (/_next\/image\?url=.*api%2Ffiles%2Fpublic%2Fmedia/.test(u)) return;
    issues.push(`[${label}] HTTP ${s} ${r.request().method()} ${u.slice(0, 140)}`);
  });
}

/** Dev-server worker occasionally restarts under load; wait for it instead of failing on ECONNREFUSED. */
async function waitForServer(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${SITE}/api/health`, { signal: AbortSignal.timeout(10_000) });
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

const results: { name: string; ok: boolean; err?: string; issues: string[] }[] = [];
const ONLY = process.env.R8_ONLY?.split(",").filter(Boolean);
async function step(name: string, fn: () => Promise<void>): Promise<void> {
  if (ONLY && !ONLY.some((p) => name.startsWith(`${p} `))) return;
  issues.length = 0;
  process.stderr.write(`>> ${name}\n`);
  await waitForServer();
  let err: string | undefined;
  try {
    await test.step(name, fn);
  } catch (e) {
    err = (e instanceof Error ? e.message : String(e)).split("\n").slice(0, 6).join(" | ");
    for (const [label, pg] of Object.entries(livePages)) {
      await pg
        .screenshot({ path: `test-results/r8-${name.split(" ")[0]}-${label}.png`, timeout: 5_000 })
        .catch(() => undefined);
    }
  }
  const seen = [...new Set(issues)];
  results.push({ name, ok: err === undefined && seen.length === 0, err, issues: seen });
  process.stderr.write(`<< ${err ? "FAIL " + err.slice(0, 300) : seen.length ? "NOISE" : "ok"}\n`);
}

// ---- helpers -----------------------------------------------------------------------------------
async function login(page: Page, base: string, email: string, password = PW): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    await q(`delete from rate_limit_buckets`);
    await waitForServer();
    await page.goto(`${base}/auth/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const btn = page.getByRole("button", { name: "Sign in", exact: true });
    try {
      await expect(btn, `login button enabled (${email})`).toBeEnabled({ timeout: 45_000 });
      await btn.click();
      process.stderr.write(`   login submitted ${email}\n`);
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 45_000 });
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
    }
  }
}

async function signUp(page: Page, name: string, email: string): Promise<void> {
  // Local only: sign-up/login are IP rate limited (R: "Too many requests"); reset the buckets.
  await q(`delete from rate_limit_buckets`);
  // better-auth's in-memory limiter allows 3 verification mails/hour/IP (sign-up sends one): give each
  // sign-up its own client IP so the fourth account is not throttled.
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto(`${SITE}/auth/register`);
  await page.locator("#reg-name").fill(name);
  await page.locator("#reg-email").fill(email);
  await page.locator("#reg-password").fill(NEWPW);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(/check your email|verification|Continue to your account/i).first(),
  ).toBeVisible({
    timeout: 90_000,
  });
}

async function userExists(email: string): Promise<boolean> {
  return (await q(`select 1 from users where email=$1`, [email])).length > 0;
}

/** Wait until every <img> matching `sel` has loaded (naturalWidth>0) and there is at least one. */
async function expectImagesLoaded(page: Page, sel: string, label: string): Promise<void> {
  await page.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect
    .poll(
      async () =>
        page.$$eval(sel, (imgs) => {
          const l = (imgs as HTMLImageElement[]).map((i) => ({
            src: i.currentSrc || i.src,
            w: i.naturalWidth,
          }));
          return l.length > 0 && l.every((i) => i.src !== "" && i.w > 0)
            ? "ok"
            : JSON.stringify(l.map((i) => `${i.w}:${i.src.slice(-60)}`));
        }),
      { timeout: 40_000, message: `${label}: cover <img> loaded` },
    )
    .toBe("ok");
}

async function visibleTextBad(page: Page): Promise<string | null> {
  const text = await page.evaluate(() => document.body.innerText);
  const m = SWEEP_BAD.exec(text);
  if (!m) return null;
  const i = m.index;
  return `"${m[0]}" in: …${text.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, " ")}…`;
}

test.describe("round 8 end to end", () => {
  test.setTimeout(2_700_000);

  let offeringId = "";
  let originalSiteName = "CodeKraft";
  const ctxs: BrowserContext[] = [];

  test.afterAll(async () => {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  });

  test("round 8 flows", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "site", "single-project spec (site)");
    const mk = async (
      label: string,
      adminHost: boolean,
    ): Promise<{ ctx: BrowserContext; page: Page }> => {
      const ctx = await browser.newContext({
        baseURL: adminHost ? ADMIN : SITE,
        viewport: { width: 1440, height: 900 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
      });
      // better-auth rate-limits sign-in per IP (3 per 10 s): give each persona its own client IP.
      await ctx.setExtraHTTPHeaders({
        "x-forwarded-for": `10.8.${ctxs.length + 1}.${ctxs.length + 10}`,
      });
      ctx.setDefaultTimeout(30_000);
      ctx.setDefaultNavigationTimeout(120_000);
      ctxs.push(ctx);
      const page = await ctx.newPage();
      // Retry navigations that hit a restarting dev server (Next recycles the worker near its memory cap).
      const rawGoto = page.goto.bind(page);
      page.goto = (async (url: string, opts?: Parameters<Page["goto"]>[1]) => {
        for (let i = 0; ; i++) {
          try {
            return await rawGoto(url, opts);
          } catch (e) {
            const m = e instanceof Error ? e.message : "";
            if (
              i >= 3 ||
              !/ERR_CONNECTION_REFUSED|ERR_ABORTED|ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET/.test(m)
            )
              throw e;
            await waitForServer();
          }
        }
      }) as Page["goto"];
      track(page, label);
      return { ctx, page };
    };

    // ============================== SETUP ==============================
    process.stderr.write(">> setup\n");
    await test.step("setup: users, settings, catalog", async () => {
      // Safety net: a previously killed run may have left admin-class users parked as suspended.
      await q(
        `update users set status='active' where status='suspended'
         and id in (select user_id from user_roles where role_key in ('super_admin','admin'))`,
      );
      // Fresh customers every run: rename any previous e2e customers out of the way.
      for (const e of [C1, C2, C3]) {
        await q(`update users set email = 'old-' || id || '@e2e-archive.test' where email=$1`, [e]);
      }
      // Sign up through the real UI in throwaway contexts (auto sign-in is discarded).
      const signup = await browser.newContext({ baseURL: SITE });
      signup.setDefaultTimeout(30_000);
      const sp = await signup.newPage();
      track(sp, "signup");
      for (const [name, email] of [
        ["E2E Customer One", C1],
        ["E2E Customer Two", C2],
        ["E2E Customer Three", C3],
      ] as const) {
        await signUp(sp, name, email);
        await sp.context().clearCookies();
      }
      if (!(await userExists(ADMIN2))) {
        await signUp(sp, "E2E Admin Two", ADMIN2);
        await sp.context().clearCookies();
      }
      await signup.close();

      // c3 must stay unverified; c1/c2 verified; admin2 -> verified super admin + partner.
      const [c3] = await q(`select email_verified as v from users where email=$1`, [C3]);
      expect(c3?.v, "c3 starts unverified").toBe(false);
      await q(`update users set email_verified=true where email in ($1,$2,$3)`, [C1, C2, ADMIN2]);
      const [a2] = await q(`select id from users where email=$1`, [ADMIN2]);
      const a2id = a2!.id as string;
      await q(
        `insert into user_roles (user_id, role_key) values ($1,'super_admin') on conflict do nothing`,
        [a2id],
      );
      if ((await q(`select 1 from partners where user_id=$1`, [a2id])).length === 0) {
        await q(`insert into partners (user_id, display_name) values ($1,'E2E Admin Two')`, [a2id]);
      }

      // Catalog: published product + cover + price, plus a coupon.
      const [prod] = await q(
        `select p.id as pid, o.id as oid, (select count(*) from product_media m where m.product_id=p.id) as media
         from products p join offerings o on o.product_id=p.id
         where p.slug=$1 and p.status='published' and o.status='active' order by o.created_at limit 1`,
        [PRODUCT_SLUG],
      );
      expect(prod, "published product + active offering exist").toBeTruthy();
      expect(Number(prod!.media), "product has cover media").toBeGreaterThan(0);
      // Local storage driver keeps objects under .local-storage/<bucket>/<key>; the seeded cover rows
      // point at objects that may not exist on this machine, so make sure the bytes are there.
      const covers = await q(
        `select md.bucket, md.object_key from product_media pm join media md on md.id=pm.media_id
         join products p on p.id=pm.product_id where p.status='published'`,
      );
      for (const c of covers) {
        const file = path.join(
          process.cwd(),
          ".local-storage",
          String(c.bucket),
          String(c.object_key),
        );
        if (!fs.existsSync(file)) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, QR_PNG);
        }
      }
      offeringId = prod!.oid as string;
      await q(
        `insert into coupons (code, kind, value, active) values ($1,'percent',1000,true)
         on conflict (code) do update set active=true, redemptions_count=0`,
        [COUPON],
      ).catch(async () => {
        await q(`update coupons set active=true where code=$1`, [COUPON]);
      });
      const [sn] = await q(`select value from site_settings where key='site_name'`);
      if (sn?.value && String(sn.value) !== NEW_SITE_NAME) originalSiteName = String(sn.value);
    });

    // contexts
    const A = await mk("adminA", true);
    const B = await mk("adminB", true);
    const C1p = await mk("c1", false);
    const C2p = await mk("c2", false);
    const C3p = await mk("c3", false);

    process.stderr.write(">> setup2\n");
    await test.step("setup: logins + payment settings via admin UI", async () => {
      await login(A.page, ADMIN, CEO);
      await login(B.page, ADMIN, ADMIN2, NEWPW);
      await login(C1p.page, SITE, C1, NEWPW);
      await login(C2p.page, SITE, C2, NEWPW);
      await login(C3p.page, SITE, C3, NEWPW);

      await A.page.goto(`${ADMIN}/admin/settings`);
      await A.page.getByRole("button", { name: "Payment methods" }).click();
      const mps = A.page.getByTestId("manual-payment-settings");
      await expect(mps).toBeVisible();
      const upi = mps.locator("#st-upi");
      if ((await upi.getAttribute("aria-checked")) !== "true") await upi.click();
      const bank = mps.locator("#st-bank");
      if ((await bank.getAttribute("aria-checked")) !== "true") await bank.click();
      await mps.locator("#st-vpa").fill(VPA);
      await mps.locator("#st-payee").fill("E2E Payee Pvt Ltd");
      await mps
        .locator("#st-qr")
        .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: QR_PNG });
      await mps.locator("#st-acct-name").fill("E2E Payee Pvt Ltd");
      await mps.locator("#st-acct-no").fill(ACCT_NO);
      await mps.locator("#st-ifsc").fill(IFSC);
      await mps.locator("#st-bank-name").fill("HDFC Bank");
      await A.page.getByRole("button", { name: "Save payment details" }).click();
      await expect(A.page.getByText(/saved|requested|approval/i).first()).toBeVisible({
        timeout: 30_000,
      });
    });

    // ============================== STEP 1 ==============================
    await step("1 unverified c3: banner, checkout/chat blocked (UI + API)", async () => {
      const p = C3p.page;
      await p.goto(`${SITE}/account`);
      await expect(p.getByText(/verify your email/i).first()).toBeVisible();
      await p.goto(`${SITE}/checkout/${offeringId}`);
      await expect(p.getByText(/Verify your email to continue/i)).toBeVisible();
      await expect(p.getByRole("button", { name: /Place order/ })).toHaveCount(0);
      // chat UI
      await p.goto(`${SITE}/account/chat`);
      await expect(p.getByText(/verify your email/i).first()).toBeVisible();
      await expect(p.getByRole("button", { name: /Talk to the team/ })).toBeDisabled();
      // chat API (server-side gate)
      expectedStatuses = [403];
      const res = await C3p.ctx.request.post(`${SITE}/api/chat`, {
        data: { conversationId: "00000000-0000-4000-8000-000000000000", content: "hello" },
        headers: { "content-type": "application/json", origin: SITE },
      });
      expectedStatuses = [];
      expect(res.status(), "chat API for unverified c3").toBe(403);
      expect(await res.text()).toContain("EMAIL_UNVERIFIED");
    });

    // ============================== STEP 2 ==============================
    await step("2 cover image on home, listing, wishlist, checkout", async () => {
      const p = C1p.page;
      await p.goto(`${SITE}/`);
      await expectImagesLoaded(p, `img[alt^="TradeFlow"]`, "home");
      await p.goto(`${SITE}/products`);
      await expectImagesLoaded(p, `img[alt^="TradeFlow"]`, "listing");
      await p.goto(`${SITE}/products/${PRODUCT_SLUG}`);
      await p.getByRole("button", { name: "Add to wishlist" }).click();
      await expect(p.getByRole("button", { name: "Remove from wishlist" })).toBeVisible({
        timeout: 10_000,
      });
      await p.goto(`${SITE}/account/wishlist`);
      await expectImagesLoaded(p, `main img`, "wishlist");
      await p.goto(`${SITE}/checkout/${offeringId}`);
      await expectImagesLoaded(p, `main img`, "checkout");
    });

    // ============================== STEP 3 ==============================
    let orderId = "";
    let orderNo = "";
    const actionIds: { url: string; id: string; body: string }[] = [];
    await step("3 c1 checkout+coupon, UTR, adminA confirms, entitlement", async () => {
      const p = C1p.page;
      p.on("request", (r) => {
        const id = r.headers()["next-action"];
        if (id && r.method() === "POST")
          actionIds.push({ url: r.url(), id, body: r.postData() ?? "" });
      });
      await p.goto(`${SITE}/checkout/${offeringId}`);
      await p.locator("#coupon").fill(COUPON);
      await p.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(p.getByLabel(`Remove coupon ${COUPON}`)).toBeVisible({ timeout: 30_000 });
      // method radios: choose UPI
      const upiRadio = p.getByRole("radio", { name: /UPI/ }).first();
      if (await upiRadio.count()) await upiRadio.check().catch(() => undefined);
      await p
        .getByRole("checkbox", { name: /license terms|I agree|accept/i })
        .first()
        .check();
      await p.getByRole("button", { name: /Place order/ }).click();
      // payment instructions
      await expect(p.getByRole("heading", { name: /Pay via UPI/ })).toBeVisible({
        timeout: 30_000,
      });
      await expect(p.getByText(VPA).first()).toBeVisible();
      await expect(p.getByAltText("Scan to pay with any UPI app")).toBeVisible();
      const qrOk = await p
        .getByAltText("Scan to pay with any UPI app")
        .evaluate((i) => (i as HTMLImageElement).naturalWidth > 0);
      expect(qrOk, "UPI QR image loads").toBe(true);
      // bank details: via the method switcher if present
      const bankTab = p.getByRole("tab", { name: /Bank transfer/ });
      if (await bankTab.count()) await bankTab.click();
      const [o] = await q(
        `select id, order_no as n from orders where user_id=(select id from users where email=$1) order by created_at desc limit 1`,
        [C1],
      );
      orderId = o!.id as string;
      orderNo = String(o!.n);
      await p.locator("#pay-ref").fill("E2EUTR123456789");
      await p.getByRole("button", { name: /I've paid/ }).click();
      await expect(p.getByText(/Reference submitted/).first()).toBeVisible({ timeout: 40_000 });

      // admin confirms
      await A.page.goto(`${ADMIN}/admin/orders/${orderId}`);
      await A.page.getByRole("button", { name: "Confirm payment" }).first().click();
      const dlg = A.page.getByRole("dialog");
      await dlg.locator("#cp-ref").fill("E2EUTR123456789");
      await dlg.locator("#cp-verified").click();
      await dlg.getByRole("button", { name: "Confirm and mark Paid" }).click();
      await expect(A.page.getByText(/Paid/).first()).toBeVisible({ timeout: 40_000 });
      const [st] = await q(`select status from orders where id=$1`, [orderId]);
      expect(st?.status, "order status").toBe("paid");
      // c1 sees success + entitlement
      await p.goto(`${SITE}/account/purchases`);
      await expect(p.getByText(/TradeFlow/i).first()).toBeVisible();
      const [ent] = await q(
        `select count(*)::int as n from entitlements where user_id=(select id from users where email=$1)`,
        [C1],
      );
      expect(Number(ent?.n), "entitlement row").toBeGreaterThan(0);
      await p.goto(`${SITE}/account/orders/${orderNo}`);
      await expect(p.getByText(/paid|thank|success|confirmed/i).first()).toBeVisible();
    });

    // step 1b: server-action gate, replayed from c1's real createOrder action with c3's cookies
    await step("1b unverified c3: createOrder server action blocked", async () => {
      const cand = actionIds.find((a) => a.body.includes("paymentMethod"));
      expect(cand, "captured createOrder action").toBeTruthy();
      const res = await C3p.ctx.request.post(cand!.url, {
        headers: {
          "next-action": cand!.id,
          "content-type": "text/plain;charset=UTF-8",
          accept: "text/x-component",
        },
        data: cand!.body,
      });
      const txt = await res.text();
      expect(txt, "server action response").toMatch(/EMAIL_UNVERIFIED|verify your email/i);
      const [n] = await q(
        `select count(*)::int as n from orders where user_id=(select id from users where email=$1)`,
        [C3],
      );
      expect(Number(n?.n), "no order created for c3").toBe(0);
    });

    // ============================== STEP 4 ==============================
    let moneyTexts: string[] = [];
    await step("4 finance: ledger payment row, dashboard money widgets", async () => {
      await A.page.goto(`${ADMIN}/admin/finance/ledger`);
      await expect(A.page.getByText(new RegExp(orderNo)).first()).toBeVisible({ timeout: 30_000 });
      const [le] = await q(`select count(*)::int as n from ledger_entries where order_id=$1`, [
        orderId,
      ]);
      expect(Number(le?.n), "ledger rows for order").toBeGreaterThan(0);
      await A.page.goto(`${ADMIN}/admin/dashboard?range=90d`);
      await expect(A.page.getByRole("heading", { name: "Revenue by period" })).toBeVisible();
      const body = await A.page.locator("main").innerText();
      moneyTexts = body.match(/₹\s?[\d,]+(\.\d+)?/g) ?? [];
      expect(
        moneyTexts.some((m) => /[1-9]/.test(m)),
        "dashboard shows a non-zero ₹ amount",
      ).toBe(true);
    });

    // ============================== STEP 5 ==============================
    await step("5 dashboard widget selection per admin", async () => {
      await A.page.goto(`${ADMIN}/admin/dashboard`);
      await B.page.goto(`${ADMIN}/admin/dashboard`);
      const bBefore = await B.page.locator("section[aria-labelledby]").count();
      const bHealthBefore = await B.page.getByRole("heading", { name: "System health" }).count();
      await A.page.getByRole("button", { name: "Customise" }).click();
      const sw = A.page.locator("#lib-system_health");
      const was = await sw.getAttribute("aria-checked");
      const saveResp = A.page
        .waitForResponse(
          (r) => r.request().method() === "POST" && r.url().includes("/admin/dashboard"),
          { timeout: 20_000 },
        )
        .catch(() => null);
      await sw.click();
      const sr = await saveResp;
      const srText = sr ? (await sr.text().catch(() => "")).slice(0, 300) : "no POST seen";
      await A.page.waitForTimeout(2000);
      const [lay] = await q(
        `select layout from dashboard_layouts where user_id=(select id from users where email=$1)`,
        [CEO],
      );
      const keys = (lay?.layout as { i: string }[] | undefined)?.map((x) => x.i) ?? [];
      expect(
        keys.includes("system_health"),
        `A layout in DB after toggle (was=${was}); save response=${srText}; keys=${keys.join(",")}`,
      ).toBe(was !== "true");
      await A.page.reload();
      await expect(A.page.getByRole("heading", { name: "System health" })).toHaveCount(
        was === "true" ? 0 : 1,
      );
      await B.page.reload();
      expect(
        await B.page.locator("section[aria-labelledby]").count(),
        "adminB widgets unchanged",
      ).toBe(bBefore);
      await expect(B.page.getByRole("heading", { name: "System health" })).toHaveCount(
        bHealthBefore,
      );
    });

    // ============================== STEP 6 ==============================
    await step("6 site name setting reflected on site", async () => {
      await A.page.goto(`${ADMIN}/admin/settings`);
      await expect(A.page.getByRole("button", { name: "Save changes" })).toBeEnabled({
        timeout: 60_000,
      });
      await A.page.locator("#st-site").fill(NEW_SITE_NAME);
      await A.page.getByRole("button", { name: "Save changes" }).click();
      await expect(A.page.getByText("Settings saved")).toBeVisible({ timeout: 30_000 });
      try {
        await C2p.page.goto(`${SITE}/`);
        await expect(C2p.page.locator("header").getByText(NEW_SITE_NAME).first()).toBeVisible({
          timeout: 30_000,
        });
        await expect(C2p.page).toHaveTitle(new RegExp(NEW_SITE_NAME));
      } finally {
        await A.page.locator("#st-site").fill(originalSiteName);
        // the first save's toast sits over the sticky Save button: dispatch the click instead
        await A.page.getByRole("button", { name: "Save changes" }).dispatchEvent("click");
        await expect(A.page.getByText("Settings saved").first()).toBeVisible({ timeout: 30_000 });
        await expect
          .poll(
            async () =>
              String((await q(`select value from site_settings where key='site_name'`))[0]?.value),
            {
              timeout: 30_000,
              message: "site name restored in DB",
            },
          )
          .toBe(originalSiteName);
      }
    });

    // ============================== STEP 7 ==============================
    await step("7 chat handoff: c2 -> admins notified -> adminA replies -> c2 sees", async () => {
      const p = C2p.page;
      await p.goto(`${SITE}/account/chat`);
      await p.getByRole("button", { name: "Talk to the team" }).click();
      await p.locator("#esc-summary").fill("R8 e2e handoff please help");
      await p.getByRole("button", { name: "Send to the team" }).click();
      await expect(p.getByText(/passed|team|queue|reply/i).first()).toBeVisible({
        timeout: 40_000,
      });
      for (const [lbl, pg] of [
        ["adminA", A.page],
        ["adminB", B.page],
      ] as const) {
        await pg.goto(`${ADMIN}/admin/notifications`);
        await expect(
          pg.getByText(/handoff|escalat|human|chat|query/i).first(),
          `${lbl} notification`,
        ).toBeVisible({ timeout: 30_000 });
      }
      const [qy] = await q(
        `select id from queries where user_id=(select id from users where email=$1) order by created_at desc limit 1`,
        [C2],
      );
      expect(qy, "query created for handoff").toBeTruthy();
      await A.page.goto(`${ADMIN}/admin/queries/${qy!.id}`);
      await A.page.locator("#q-composer").fill("Hello from adminA, we got your chat.");
      await A.page.getByRole("button", { name: "Reply", exact: true }).click();
      // Wait for the reply to be committed before the customer loads the thread (the page is not live).
      await expect
        .poll(
          async () =>
            Number(
              (
                await q(
                  `select count(*)::int as n from query_messages where query_id=$1 and author_kind='admin'`,
                  [qy!.id],
                )
              )[0]?.n,
            ),
          { timeout: 30_000, message: "admin reply saved" },
        )
        .toBeGreaterThan(0);
      await p.goto(`${SITE}/account/queries/${qy!.id}`);
      await expect(p.getByText("Hello from adminA, we got your chat.")).toBeVisible({
        timeout: 30_000,
      });
    });

    // ============================== STEP 8 ==============================
    await step(
      "8 leads/quotes: c2 inquiry -> admin lead + notification -> quote -> c2 sees",
      async () => {
        const p = C2p.page;
        await p.goto(`${SITE}/contact`);
        await p.locator('input[id*="name"]').first().fill("E2E Customer Two");
        await p.locator('input[type="email"]').first().fill(C2);
        await p
          .locator("textarea")
          .first()
          .fill("R8 e2e: need a custom dashboard built, please quote.");
        await p.getByRole("button", { name: "Send inquiry" }).click();
        await expect(p.getByText(/thank|received|sent|reply/i).first()).toBeVisible({
          timeout: 40_000,
        });
        await A.page.goto(`${ADMIN}/admin/leads`);
        await expect(A.page.getByText(/E2E Customer Two|custom dashboard/i).first()).toBeVisible({
          timeout: 30_000,
        });
        await A.page.goto(`${ADMIN}/admin/notifications`);
        await expect(A.page.getByText(/lead|inquiry/i).first()).toBeVisible();
        // quote
        await A.page.goto(`${ADMIN}/admin/quotes`);
        await A.page
          .getByRole("button", { name: /New quote/i })
          .first()
          .click()
          .catch(() => undefined);
        const form = A.page
          .getByRole("form", { name: "New quote" })
          .or(A.page.locator("form").filter({ has: A.page.locator("#q-title") }));
        await form.locator("#q-customer").click();
        await A.page.getByRole("option", { name: /e2e-c2@codekraft\.test/ }).click();
        const quoteTitle = `R8 e2e custom quote ${Date.now()}`;
        await form.locator("#q-title").fill(quoteTitle);
        await form.locator("#q-amount").fill("25000");
        await form.getByRole("button", { name: "Save" }).click();
        await expect(A.page.getByText(quoteTitle).first()).toBeVisible({ timeout: 30_000 });
        // send
        await A.page.getByText(quoteTitle).first().click();
        await A.page.getByRole("button", { name: "Send to customer" }).click();
        await expect(A.page.getByText(/Sent/).first()).toBeVisible({ timeout: 30_000 });
        // c2 sees it (wait until the send has committed and notified the customer)
        await expect
          .poll(
            async () =>
              Number(
                (
                  await q(
                    `select count(*)::int as n from notifications where type='quote.sent' and user_id=(select id from users where email=$1) and created_at > now() - interval '5 minutes'`,
                    [C2],
                  )
                )[0]?.n,
              ),
            { timeout: 30_000, message: "quote.sent notification" },
          )
          .toBeGreaterThan(0);
        await p.goto(`${SITE}/account/notifications`);
        await expect(p.getByText(/quote/i).first()).toBeVisible({ timeout: 30_000 });
      },
    );

    // ============================== STEP 4b / 9 (approval engine) ==============================
    // The engine needs EVERY other active super admin/admin to approve. The local DB also has other
    // admin-class users, so park them (suspended) for the duration so that adminB alone is the approver.
    const parked: string[] = [];
    const parkOthers = async (): Promise<void> => {
      const rows = await q(
        `select distinct u.id from users u join user_roles r on r.user_id=u.id
         where r.role_key in ('super_admin','admin') and u.status='active' and u.email not in ($1,$2)`,
        [CEO, ADMIN2],
      );
      for (const r of rows) {
        parked.push(String(r.id));
        await q(`update users set status='suspended' where id=$1`, [r.id]);
      }
    };
    const unparkOthers = async (): Promise<void> => {
      for (const id of parked.splice(0))
        await q(`update users set status='active' where id=$1`, [id]);
    };
    const approveAsB = async (needle: string): Promise<void> => {
      await B.page.goto(`${ADMIN}/admin/approvals`);
      await B.page.waitForLoadState("networkidle").catch(() => undefined);
      await B.page.getByText(needle).first().click();
      // The first click can land before React hydrates the inbox; retry until the decision toast shows.
      for (let attempt = 0; ; attempt++) {
        const respP = B.page
          .waitForResponse(
            (r) => r.request().method() === "POST" && r.url().includes("/admin/approvals"),
            { timeout: 15_000 },
          )
          .catch(() => null);
        await B.page
          .getByRole("button", { name: /^Approve/ })
          .first()
          .click();
        const resp = await respP;
        const respText = resp ? (await resp.text().catch(() => "")).slice(0, 400) : "no POST";
        try {
          await expect(B.page.getByText(/Approval recorded|Approved/i).first()).toBeVisible({
            timeout: 12_000,
          });
          return;
        } catch (e) {
          const toasts = await B.page.locator("[data-sonner-toast]").allInnerTexts();
          if (attempt >= 1)
            throw new Error(
              `approve not recorded; toasts=${JSON.stringify(toasts)}; response=${respText}; ${String(e).slice(0, 80)}`,
            );
        }
      }
    };

    await step("4b finance: adjustment (A requests, B approves) adds a ledger row", async () => {
      await q(
        `update approval_requests set status='cancelled' where status='pending' and type='ledger.adjustment'`,
      ).catch(() => undefined);
      await parkOthers();
      try {
        const [before] = await q(
          `select count(*)::int as n from ledger_entries where memo like 'R8E2E adjustment%'`,
        );
        await A.page.goto(`${ADMIN}/admin/finance/adjustments`);
        await A.page.getByRole("button", { name: /New adjustment/ }).click();
        await A.page
          .locator("#adj-reason")
          .fill("R8E2E adjustment: correcting a test posting, round 8 e2e.");
        await A.page.locator("#ln-amount-1").fill("500.00");
        await A.page.locator("#ln-memo-1").fill("R8E2E adjustment bank");
        await A.page.locator("#ln-amount-2").fill("-500.00");
        await A.page.locator("#ln-memo-2").fill("R8E2E adjustment company");
        await A.page.getByRole("button", { name: "Request approval" }).click();
        await expect(A.page.getByText(/sent for approval/i).first()).toBeVisible({
          timeout: 30_000,
        });
        await approveAsB("R8E2E adjustment");
        await expect
          .poll(
            async () =>
              Number(
                (
                  await q(
                    `select count(*)::int as n from ledger_entries where memo like 'R8E2E adjustment%'`,
                  )
                )[0]?.n,
              ),
            {
              timeout: 30_000,
              message: "ledger rows posted after approval",
            },
          )
          .toBeGreaterThan(Number(before?.n));
        await A.page.goto(`${ADMIN}/admin/finance/ledger`);
        await expect(A.page.getByText(/R8E2E adjustment/).first()).toBeVisible({ timeout: 30_000 });
      } finally {
        await unparkOthers();
      }
    });

    // ============================== STEP 9 ==============================
    await step("9 staff invite via approval engine (A requests, B approves)", async () => {
      const staffEmail = `e2e-staff-${Date.now()}@codekraft.test`;
      await parkOthers();
      try {
        await A.page.goto(`${ADMIN}/admin/admin-users`);
        await A.page.getByRole("button", { name: /Invite admin/ }).click();
        const dlg = A.page.getByRole("dialog");
        await dlg.locator("#inv-email").fill(staffEmail);
        await dlg.getByRole("radio", { name: /Staff/ }).click();
        await dlg
          .getByRole("button", { name: /Send|Invite|Request/ })
          .last()
          .click();
        await expect(A.page.getByText(/Invite approval requested/)).toBeVisible({
          timeout: 30_000,
        });
        await approveAsB(staffEmail);
        await expect
          .poll(
            async () =>
              (
                await q(`select status from approval_requests where payload->>'email'=$1`, [
                  staffEmail,
                ])
              )[0]?.status,
            {
              timeout: 30_000,
              message: "invite approval status",
            },
          )
          .toMatch(/approved|applied/);
        const [u] = await q(`select id from users where email=$1`, [staffEmail]);
        expect(u, "staff user created after approval").toBeTruthy();
        const roles = await q(`select role_key from user_roles where user_id=$1`, [u!.id]);
        expect(roles.map((r) => r.role_key)).toContain("staff");
      } finally {
        await unparkOthers();
      }
    });

    // ============================== STEP 10 ==============================
    await step("10 sweep admin nav + site pages", async () => {
      const bad: string[] = [];
      const adminRoutes = [
        "dashboard",
        "approvals",
        "notifications",
        "products",
        "categories",
        "coupons",
        "orders",
        "quotes",
        "customers",
        "entitlements",
        "delivery-tasks",
        "leads",
        "queries",
        "chatbot",
        "finance/ledger",
        "finance/allocations",
        "finance/partners",
        "finance/expenses",
        "finance/adjustments",
        "finance/reports",
        "content/landing",
        "content/services",
        "content/case-studies",
        "content/testimonials",
        "content/blog",
        "content/faqs",
        "content/legal",
        "settings",
        "audit",
        "admin-users",
      ];
      const siteRoutes = [
        "/",
        "/products",
        `/products/${PRODUCT_SLUG}`,
        "/services",
        "/projects",
        "/blog",
        "/contact",
        "/search",
        "/legal/terms",
        "/legal/privacy",
        "/legal/license",
      ];
      const acctRoutes = [
        "/account",
        "/account/orders",
        "/account/purchases",
        "/account/invoices",
        "/account/queries",
        "/account/chat",
        "/account/notifications",
        "/account/wishlist",
        "/account/settings",
      ];
      const visit = async (pg: Page, url: string): Promise<void> => {
        const before = issues.length;
        const res = await pg.goto(url, { waitUntil: "load" });
        await pg.waitForTimeout(400);
        if ((res?.status() ?? 0) >= 500) bad.push(`${url}: HTTP ${res?.status()}`);
        const t = await visibleTextBad(pg);
        if (t) bad.push(`${url}: ${t}`);
        if (issues.length > before)
          bad.push(`${url}: ${issues.slice(before).join(" ; ").slice(0, 200)}`);
      };
      for (const r of adminRoutes) await visit(A.page, `${ADMIN}/admin/${r}`);
      for (const r of siteRoutes) await visit(C2p.page, `${SITE}${r}`);
      for (const r of acctRoutes) await visit(C1p.page, `${SITE}${r}`);
      issues.length = 0; // folded into `bad`
      process.stderr.write(
        `SWEEP FINDINGS (${bad.length})\n${bad.map((b) => `  ${b.slice(0, 260)}`).join("\n")}\n`,
      );
      expect(bad, `sweep findings:\n${bad.join("\n")}`).toEqual([]);
    });

    // ============================== REPORT ==============================
    for (const c of ctxs) await c.close().catch(() => undefined);
    const lines = results.map(
      (r) =>
        `${r.ok ? "PASS" : "FAIL"} ${r.name}${r.err ? `\n    error: ${r.err}` : ""}${
          r.issues.length ? `\n    noise: ${r.issues.slice(0, 6).join("\n           ")}` : ""
        }`,
    );
    console.log(`\n===== ROUND 8 RESULTS =====\n${lines.join("\n")}\n==========================`);
    expect(
      results.filter((r) => !r.ok).map((r) => r.name),
      "failed steps",
    ).toEqual([]);
  });
});
