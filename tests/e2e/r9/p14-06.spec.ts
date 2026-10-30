/**
 * P14-06: chat + support-query attachments. A customer attaches an image and a txt in the account
 * chat and in a query; an admin sees and downloads them (query inbox + chat handoff); another
 * customer cannot open the attachment URL; a disallowed type is refused with a clear message.
 * No AI key locally: the chat UI must simply not crash (the AI request builder is unit-tested).
 */
import { expect, test, type Page } from "@playwright/test";

import { ADMIN, SITE, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

test.setTimeout(240_000);

const TAG = `p1406-${Date.now()}`;
// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
const txt = (name: string) => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(`order notes ${TAG}\nsecond line`),
});

async function idOf(sql: string, params: unknown[]): Promise<string> {
  const [row] = await q<{ id: string }>(sql, params);
  if (!row) throw new Error(`no row for: ${sql}`);
  return row.id;
}

async function attach(page: Page, files: Parameters<Page["setInputFiles"]>[1]) {
  await page.getByTestId("attach-input").first().setInputFiles(files);
}

test("P14-06 customer attaches in chat and query, admin sees and downloads, stranger blocked", async ({
  page,
  browser,
}) => {
  const issues = trackIssues(page, [/\/api\/chat/]);
  await loginAs(page, "customer");

  /* ---- chat: disallowed type, oversize, then image + txt ------------------------------- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${SITE}/account/chat`);
  // The first change event can land before React hydrates the composer (slow mobile): retry it.
  await expect(async () => {
    await attach(page, {
      name: "evil.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
    await expect(page.getByTestId("attach-error")).toContainText(/not allowed/i, {
      timeout: 2_000,
    });
  }).toPass({ timeout: 20_000 });
  await attach(page, {
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(11 * 1024 * 1024),
  });
  await expect(page.getByTestId("attach-error")).toContainText(/larger than/i);

  await attach(page, [png(`${TAG}-chat.png`), txt(`${TAG}-chat.txt`)]);
  await expect(page.getByLabel(`Remove ${TAG}-chat.png`)).toBeVisible();
  await expect(page.getByLabel(`Remove ${TAG}-chat.txt`)).toBeVisible();
  await page
    .getByPlaceholder(/Ask about your orders|Verify your email/)
    .fill(`Here are my files ${TAG}`);
  await page.getByRole("button", { name: "Send" }).click();
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByRole("img", { name: `${TAG}-chat.png` })).toBeVisible();
  await expect(log.getByText(`${TAG}-chat.txt`)).toBeVisible();
  await expect(log.getByRole("link", { name: `Download ${TAG}-chat.txt` })).toBeVisible();

  // Hand the conversation to the team: the files travel with the handoff.
  await page.getByRole("button", { name: "Talk to the team" }).click();
  await page.getByRole("button", { name: "Send to the team" }).click();
  await expect(page.getByText("Sent to our team").first()).toBeVisible({ timeout: 30_000 });

  /* ---- query: new query with attachments, then a reply with one ------------------------ */
  await page.goto(`${SITE}/account/queries`);
  await page.getByRole("button", { name: "New query" }).first().click();
  await page.getByLabel("Subject").fill(`Files ${TAG}`);
  await page.getByLabel("Message").fill("Please look at the attached screenshot and notes.");
  await attach(page, [png(`${TAG}-q.png`), txt(`${TAG}-q.txt`)]);
  await expect(page.getByLabel(`Remove ${TAG}-q.txt`)).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Query sent/)).toBeVisible({ timeout: 30_000 });

  const queryId = await idOf(`select id from queries where subject = $1`, [`Files ${TAG}`]);
  await page.goto(`${SITE}/account/queries/${queryId}`);
  await expect(page.getByRole("img", { name: `${TAG}-q.png` })).toBeVisible();
  await attach(page, txt(`${TAG}-reply.txt`));
  await page.getByLabel("Reply", { exact: true }).fill("Adding one more file.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(`${TAG}-reply.txt`).first()).toBeVisible({ timeout: 30_000 });

  /* ---- widths on the account chat ------------------------------------------------------- */
  for (const w of [375, 768, 1280] as const) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${SITE}/account/chat`);
    await expectNoOverflow(page);
    await expect(page.getByRole("button", { name: "Attach" })).toBeVisible();
  }
  issues.assertClean();

  /* ---- authz: stranger and anonymous get 404, owner gets the bytes ---------------------- */
  const pngId = await idOf(`select id from media where original_name = $1`, [`${TAG}-q.png`]);
  const own = await page.request.get(`${SITE}/api/files/attachment/${pngId}`);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toContain("image/png");

  // A second, real customer (registered through the UI) is refused with 404.
  const stranger = await browser.newContext();
  const sp = await stranger.newPage();
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await stranger.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await q(`delete from rate_limit_buckets`);
  await sp.goto(`${SITE}/auth/register`);
  await sp.locator("#reg-name").fill("P1406 Stranger");
  await sp.locator("#reg-email").fill(`${TAG}@codekraft.test`);
  await sp.locator("#reg-password").fill("R9-Thirteen-Pass#2026");
  await sp.getByRole("button", { name: "Create account" }).click();
  await expect(
    sp.getByText(/check your email|verification|Continue to your account/i).first(),
  ).toBeVisible({ timeout: 90_000 });
  expect((await sp.request.get(`${SITE}/api/files/attachment/${pngId}`)).status()).toBe(404);
  await stranger.close();
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  expect([401, 404]).toContain(
    (await ap.request.get(`${SITE}/api/files/attachment/${pngId}`)).status(),
  );
  await anon.close();

  /* ---- admin: sees both threads' files and downloads ------------------------------------ */
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "admin");
  await admin.setViewportSize({ width: 1280, height: 900 });
  await admin.goto(`${ADMIN}/admin/queries/${queryId}`);
  await expect(admin.getByRole("img", { name: `${TAG}-q.png` }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(admin.getByText(`${TAG}-reply.txt`).first()).toBeVisible();
  const dl = await admin.request.get(`${ADMIN}/api/files/attachment/${pngId}?download=1`);
  expect(dl.status()).toBe(200);
  expect(dl.headers()["content-disposition"]).toContain("attachment");

  // Chat handoff: the escalated query carries the chat files.
  const handoffId = await idOf(
    `select q.id from queries q join query_messages m on m.query_id = q.id
       join media md on md.id = any(m.attachments)
      where q.source = 'chatbot' and md.original_name = $1 limit 1`,
    [`${TAG}-chat.txt`],
  );
  await admin.goto(`${ADMIN}/admin/queries/${handoffId}`);
  await expect(admin.getByText(`${TAG}-chat.txt`).first()).toBeVisible({ timeout: 30_000 });
  await adminCtx.close();

  await q(`delete from queries where subject = $1 or source = 'chatbot' and id = $2`, [
    `Files ${TAG}`,
    handoffId,
  ]);
  await q(`delete from users where email = $1`, [`${TAG}@codekraft.test`]);
});
