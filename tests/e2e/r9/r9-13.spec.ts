/**
 * R9-13: a brand-new signup's chat (unverified email, no AI key locally) is persisted, shows in the
 * admin chatbot list with their email, and the human handoff raises an admin notification.
 */
import { expect, test } from "@playwright/test";

import { ADMIN, SITE, atWidths, expectNoOverflow, loginAs, q, trackIssues } from "./helpers";

// Must satisfy the register form's rules (upper+lower, digit, symbol, 12+); helpers' PASSWORD is lowercase-only.
const NEW_PASSWORD = "R9-Thirteen-Pass#2026";

test.setTimeout(240_000);

test("R9-13 new customer chat + handoff reach the admin chatbot list and bell", async ({
  page,
  browser,
}) => {
  const email = `r9-13-${Date.now()}@codekraft.test`;
  const issues = trackIssues(page, [/\/api\/chat/]);

  // Register through the UI (own client IP so the verification-mail limiter never throttles).
  await q(`delete from rate_limit_buckets`);
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto(`${SITE}/auth/register`);
  await page.locator("#reg-name").fill("R9 Thirteen");
  await page.locator("#reg-email").fill(email);
  await page.locator("#reg-password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(/check your email|verification|Continue to your account/i).first(),
  ).toBeVisible({ timeout: 90_000 });

  // Widget at 3 widths (no overflow, composer present), then chat for real.
  await atWidths(page, `${SITE}/account/chat`, async () => {
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${SITE}/account/chat`);
  await page
    .getByPlaceholder(/Ask about your orders|Verify your email/)
    .fill("Hi, I just signed up and need help");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Hi, I just signed up and need help")).toBeVisible();
  await page.getByRole("button", { name: "Talk to a human" }).first().click();
  await page.locator("#esc-summary").fill("R9-13 please help");
  await page.getByRole("button", { name: "Send to the team" }).click();
  await expect(page.getByText(/passed this conversation|team/i).first()).toBeVisible({
    timeout: 40_000,
  });

  const [u] = await q<{ id: string }>(`select id from users where email=$1`, [email]);
  expect(u, "user row").toBeTruthy();
  const msgs = await q(
    `select 1 from chat_messages m join conversations c on c.id=m.conversation_id where c.user_id=$1 and m.role='user'`,
    [u!.id],
  );
  expect(msgs.length, "user message persisted").toBeGreaterThan(0);

  // Super admin: chatbot list shows the new email; bell shows the handoff.
  const adminCtx = await browser.newContext();
  const ap = await adminCtx.newPage();
  await loginAs(ap, "super_admin");
  for (const w of [375, 768, 1280]) {
    await ap.setViewportSize({ width: w, height: 900 });
    await ap.goto(`${ADMIN}/admin/chatbot`);
    // Admin chatbot is a laptop-only screen (<1024px shows a "designed for laptops" notice).
    if (w >= 1024) {
      await expect(ap.getByRole("cell", { name: email }).first()).toBeVisible({ timeout: 30_000 });
    } else {
      await expect(ap.getByText(/designed for laptops/i)).toBeVisible();
    }
    await expectNoOverflow(ap);
  }
  await ap.setViewportSize({ width: 1280, height: 900 });
  await ap.goto(`${ADMIN}/admin`);
  await ap.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
  await expect(ap.getByText(/asked for the team/i).first()).toBeVisible({ timeout: 30_000 });
  await adminCtx.close();

  issues.assertClean();
});
