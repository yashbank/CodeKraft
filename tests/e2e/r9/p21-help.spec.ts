/**
 * P21-3: "Ask me anything" help UI. /api/help/ask is mocked with page.route (no backend, no LLM).
 * Runs at 375/768/1280 in both themes: axe, focus trap, no overflow, no CSP console errors.
 * Screenshots go to test-results/p21-help/.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { SITE, WIDTHS } from "./helpers";

test.setTimeout(60_000);
const THEMES = ["dark-cinematic", "light-editorial"] as const;
const SHOTS = "test-results/p21-help";

const ANSWER = {
  answer:
    "To download a purchase:\n1. Open **Purchases** from your account.\n2. Pick the product.\n3. Press **Download**.\n\n[evil](https://evil.test) stays plain text.",
  sources: [
    { id: "purchases-download", title: "Downloading a purchase" },
    { id: "unknown-guide", title: "Getting started" },
  ],
  mode: "guide",
};

async function setup(page: Page, theme: string, width: number, answer: unknown = ANSWER) {
  await page.setViewportSize({ width, height: width < 500 ? 740 : 800 });
  await page.context().addCookies([
    { name: "ck_theme", value: theme, url: SITE },
    { name: "ck_cookie_notice", value: "seen", url: SITE },
  ]);
  await page.route("**/api/help/ask", async (route) => {
    await new Promise((r) => setTimeout(r, 250));
    await route.fulfill({ json: answer });
  });
}

function watchCsp(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) seen.push(m.text());
  });
  return seen;
}

async function noOverflow(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(0);
}

for (const theme of THEMES)
  for (const width of WIDTHS)
    test(`help ${theme} @${width}`, async ({ page }) => {
      fs.mkdirSync(SHOTS, { recursive: true });
      const csp = watchCsp(page);
      await setup(page, theme, width);
      await page.goto(`${SITE}/`);
      const launcher = page.getByTestId("help-launcher");
      await expect(launcher).toBeVisible();
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}/${theme}-${width}-0-launcher.png` });

      // "?" opens (page body focused)
      await page.locator("body").click({ position: { x: 5, y: 300 } });
      await page.keyboard.press("?");
      const panel = page.getByTestId("help-panel");
      await expect(panel).toBeVisible();
      await expect(page.getByTestId("help-panel").getByRole("textbox")).toBeFocused();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/${theme}-${width}-1-open.png` });

      // axe on the open dialog
      const { violations } = await new AxeBuilder({ page })
        .include('[data-testid="help-panel"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes[0]?.target[0]}`),
        "axe",
      ).toEqual([]);

      // focus trap: tab many times, focus never leaves the panel
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(
          () => !!document.activeElement?.closest('[data-testid="help-panel"]'),
        );
        expect(inside, `tab ${i}`).toBe(true);
      }

      // ask via chip, see answer, sources, no raw external link
      // First suggestion chip (the text comes from knowledge/suggestions.json, so do not hard-code it).
      await panel.locator("ul button").first().click();
      await expect(page.getByTestId("help-typing")).toBeVisible();
      await expect(page.getByTestId("help-answer")).toContainText("Open Purchases");
      await expect(panel.getByRole("link", { name: /downloading a purchase/i })).toHaveAttribute(
        "href",
        "/account/purchases",
      );
      expect(await panel.locator('a[href^="http"]').count()).toBe(0);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/${theme}-${width}-2-answer.png` });
      await noOverflow(page);

      // Esc closes and returns focus
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(launcher).toBeFocused();
      expect(csp).toEqual([]);
    });

test("error and search-only states", async ({ page }) => {
  await setup(page, "dark-cinematic", 1280, {
    answer: "Closest guide.",
    sources: [],
    mode: "search",
  });
  await page.goto(`${SITE}/`);
  await page.getByTestId("help-launcher").click();
  await page.getByTestId("help-panel").getByRole("textbox").fill("budget question");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("help-search-only")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/dark-1280-3-search-only.png` });
  await page.unroute("**/api/help/ask");
  await page.route("**/api/help/ask", (r) => r.fulfill({ status: 500, body: "nope" }));
  await page.getByTestId("help-panel").getByRole("textbox").fill("second");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("help-error")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/dark-1280-4-error.png` });
});

test("mic: live interim text, listening state, stop on second tap", async ({ page }) => {
  // String script: avoids the test transpiler's helpers leaking into the page.
  await page.addInitScript(`(() => {
    function R() { this.onresult = null; this.onend = null; }
    R.prototype.start = function () {
      var self = this;
      setTimeout(function () { self.onresult && self.onresult({ results: [[{ transcript: "where are my invoices" }]] }); }, 100);
    };
    R.prototype.stop = function () { this.onend && this.onend(); };
    R.prototype.abort = function () {};
    window.webkitSpeechRecognition = R; window.SpeechRecognition = R;
  })();`);
  await setup(page, "light-editorial", 375);
  await page.goto(`${SITE}/`);
  await page.getByTestId("help-launcher").click();
  await page.getByTestId("help-mic").click();
  await expect(page.getByTestId("help-listening")).toBeVisible();
  await expect(page.getByTestId("help-panel").getByRole("textbox")).toHaveValue(
    "where are my invoices",
  );
  await page.screenshot({ path: `${SHOTS}/light-375-5-listening.png` });
  await page.getByTestId("help-mic").click();
  await expect(page.getByTestId("help-listening")).toBeHidden();
});

test("mic hidden when unsupported", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  });
  await setup(page, "dark-cinematic", 1280);
  await page.goto(`${SITE}/`);
  await page.getByTestId("help-launcher").click();
  await expect(page.getByTestId("help-panel")).toBeVisible();
  await expect(page.getByTestId("help-mic")).toHaveCount(0);
});
