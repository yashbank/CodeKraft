import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e/axe harness (P1.9, docs/10 §6, §8, §10).
 *
 * Hosts: the site and admin apps are the same Next server on port 3000 distinguished by host
 * (arch §8). Each project sets `baseURL` to the real host — `admin.localhost` resolves to
 * 127.0.0.1 on macOS and Linux (and in Chromium) without an /etc/hosts entry, so the middleware
 * host rewrite is exercised on real requests; a Host header override alone would not carry the
 * origin through client-side navigation, cookies or redirects.
 *
 * PR matrix: Desktop Chrome + Mobile Chrome (Pixel 7). The nightly `@full` matrix (WebKit,
 * Firefox, Mobile Safari) is enabled with E2E_FULL=1 once those browsers are installed.
 */
const isCI = Boolean(process.env.CI);
const PORT = Number(process.env.PORT ?? 3000);
const SITE_URL = process.env.E2E_SITE_URL ?? `http://localhost:${PORT}`;
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? `http://admin.localhost:${PORT}`;
const full = process.env.E2E_FULL === "1";

const desktopChrome = devices["Desktop Chrome"];
const mobileChrome = devices["Pixel 7"];

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "site", use: { ...desktopChrome, baseURL: SITE_URL } },
    { name: "site-mobile", use: { ...mobileChrome, baseURL: SITE_URL } },
    { name: "admin", use: { ...desktopChrome, baseURL: ADMIN_URL } },
    { name: "admin-mobile", use: { ...mobileChrome, baseURL: ADMIN_URL } },
    ...(full
      ? [
          { name: "site-webkit", use: { ...devices["Desktop Safari"], baseURL: SITE_URL } },
          { name: "site-firefox", use: { ...devices["Desktop Firefox"], baseURL: SITE_URL } },
          { name: "site-mobile-safari", use: { ...devices["iPhone 14"], baseURL: SITE_URL } },
          { name: "admin-webkit", use: { ...devices["Desktop Safari"], baseURL: ADMIN_URL } },
        ]
      : []),
  ],
  webServer: {
    command: isCI ? "pnpm build && pnpm start" : "pnpm dev",
    url: SITE_URL,
    reuseExistingServer: !isCI,
    timeout: isCI ? 300_000 : 120_000,
    stdout: "ignore",
    stderr: "pipe",
    env: { PORT: String(PORT) },
    // pnpm's native launcher runs the script in its own process group, so Playwright's default
    // SIGKILL on the wrapper orphans `next dev` and the run hangs on the open stderr pipe.
    // SIGTERM first lets pnpm forward the signal down to next; SIGKILL follows after 5 s.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
