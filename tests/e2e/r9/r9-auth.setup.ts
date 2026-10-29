/**
 * R9 setup project: one real form login per role, saved as storage state. The app keeps a single
 * active session per user (D-1203), so a second login for the same role would revoke the first;
 * every other spec reuses these cookies and never logs in again.
 */
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { authFile, loginAs, type Role } from "./helpers";

for (const role of ["customer", "super_admin", "admin", "staff"] as const satisfies Role[])
  test(`[${role}] /auth/login - signs in and lands on home`, async ({ page }) => {
    await loginAs(page, role, true);
    expect(new URL(page.url()).pathname, "post-login landing").toMatch(
      role === "customer" ? /^\/account/ : /^\/(admin|dashboard)/,
    );
    fs.mkdirSync("test-results/r9-auth", { recursive: true });
    await page.context().storageState({ path: authFile(role) });
  });
