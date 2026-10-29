/**
 * Phase 13 (R9) Playwright helpers: role logins, local-DB access, width checks, issue tracking.
 * Runs against a production build (`next build` + `next start`) on a LOCAL database only.
 */
import fs from "node:fs";
import { expect, type Cookie, type Page } from "@playwright/test";
import postgres from "postgres";

export const SITE = process.env.E2E_SITE_URL ?? "http://localhost:3000";
export const ADMIN = process.env.E2E_ADMIN_URL ?? "http://admin.localhost:3000";
/** Seeded local passphrase for every R9 role user (scripts/seed/identity.ts). */
export const PASSWORD = "local-super-admin-passphrase-2026";

export type Role = "customer" | "super_admin" | "admin" | "staff";
export const ROLE_EMAILS: Record<Role, string> = {
  customer: "buyer@codekraft.test",
  super_admin: "yashbank2002@gmail.com",
  admin: "admin@codekraft.test",
  staff: "staff@codekraft.test",
};
export const WIDTHS = [375, 768, 1280] as const;

function dbUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url))
    throw new Error("refusing: DATABASE_URL is not local");
  return url;
}

let client: ReturnType<typeof postgres> | undefined;
/** Query the LOCAL test database (refuses any non-localhost URL). */
export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  client ??= postgres(dbUrl(), { max: 2, prepare: false, onnotice: () => {} });
  return (await client.unsafe(text, params as never[])) as unknown as T[];
}

/** Storage-state file written by r9-auth.setup.ts (one login per role per run). */
export const authFile = (role: Role): string => `test-results/r9-auth/${role}.json`;

/** Base URL for a role's home host: customers use the site, the rest the admin host. */
export const baseFor = (role: Role): string => (role === "customer" ? SITE : ADMIN);

/**
 * Sign a role in. Reuses the r9-setup session cookies when present: the app keeps one active
 * session per user (D-1203), so a fresh form login here would sign out every other spec's page.
 * `fresh` forces the real login form (used by r9-auth.setup.ts).
 */
export async function loginAs(page: Page, role: Role, fresh = false): Promise<void> {
  const base = baseFor(role);
  if (!fresh && fs.existsSync(authFile(role))) {
    const state = JSON.parse(fs.readFileSync(authFile(role), "utf8")) as { cookies: Cookie[] };
    await page.context().addCookies(state.cookies);
    // Another spec may have form-logged this user in, which revokes the saved session: re-login.
    const res = await page.request.get(`${base}/api/auth/get-session`);
    const alive = res.ok() && !["", "null"].includes((await res.text()).trim());
    if (alive) {
      await page.goto(base);
      return;
    }
    await page.context().clearCookies();
    await loginAs(page, role, true);
    await page.context().storageState({ path: authFile(role) });
    return;
  }
  await formLogin(page, base, ROLE_EMAILS[role]);
}

/** Real login form with retries: the auth rate limiter can bounce a sign-in back to /auth/login. */
export async function formLogin(page: Page, base: string, email: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    await q(`delete from rate_limit_buckets`);
    await page.goto(`${base}/auth/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    const btn = page.getByRole("button", { name: "Sign in", exact: true });
    try {
      await expect(btn).toBeEnabled({ timeout: 20_000 });
      await btn.click();
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
      return;
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
}

/** Collect console errors and 5xx responses on a page; call `.assertClean()` at the end. */
export function trackIssues(page: Page, allow: RegExp[] = []) {
  const issues: string[] = [];
  const ok = (t: string) => allow.some((r) => r.test(t));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/Failed to load resource/.test(t) && !ok(t))
      issues.push(`console: ${t.slice(0, 200)}`);
  });
  page.on(
    "pageerror",
    (e) => !ok(e.message) && issues.push(`pageerror: ${e.message.slice(0, 200)}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 500 && !ok(r.url())) issues.push(`${r.status()} ${r.url()}`);
  });
  return {
    issues,
    assertClean: () => expect(issues, issues.join("\n")).toEqual([]),
  };
}

/** Fail if the page scrolls horizontally at the current viewport width. */
export async function expectNoOverflow(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(
    over,
    `horizontal overflow ${over}px at ${page.viewportSize()?.width}px`,
  ).toBeLessThanOrEqual(1);
}

/** Visit `url` at each of 375/768/1280 and run `check` (plus the overflow check). */
export async function atWidths(
  page: Page,
  url: string,
  check?: (w: number) => Promise<void>,
): Promise<void> {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(url);
    await expectNoOverflow(page);
    if (check) await check(w);
  }
}
