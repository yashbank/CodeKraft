import { expect, test, type APIRequestContext } from "@playwright/test";

const SITE = "http://localhost:3000";
const ADMIN = "http://admin.localhost:3000";
const PW = "e2e-passphrase-long-enough-9";

async function signUp(request: APIRequestContext, email: string) {
  const res = await request.post(`${SITE}/api/auth/sign-up/email`, {
    headers: { origin: SITE },
    data: { email, password: PW, name: "E2E" },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe("login / logout (S-00, docs/09 §3)", () => {
  test("customer signs in on the site host, sees the account page, signs out", async ({
    page,
    request,
  }) => {
    const email = `e2e-${Date.now()}@example.com`;
    await signUp(request, email);
    await page.goto(`${SITE}/auth/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PW);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId("account-email")).toContainText(email);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${SITE}/`);
    await page.goto(`${SITE}/account`);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("a customer account cannot sign in on the admin host", async ({ page, request }) => {
    const email = `e2e-adm-${Date.now()}@example.com`;
    await signUp(request, email);
    await page.goto(`${ADMIN}/auth/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PW);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form [role=alert]")).toContainText(/invalid/i);
  });

  test("wrong password shows an error, never a session", async ({ page }) => {
    await page.goto(`${SITE}/auth/login`);
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
