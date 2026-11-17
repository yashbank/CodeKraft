/**
 * P22-3: rich help answers (summary, numbered steps, tip, "Open <screen>" buttons, Related chips).
 * /api/help/ask is mocked with page.route: no LLM, no backend answer logic. Staff + admin on the admin host.
 */
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, loginAs, type Role } from "./helpers";

test.setTimeout(60_000);

const RICH = {
  answer:
    "Mark an order shipped so the customer is told.\n1. Open the order.\n2. Pick the items.\n3. Press **Mark shipped**.\n\nTip: check the delivery address first.",
  sources: [{ id: "fulfil-order", title: "Fulfil an order" }],
  mode: "guide",
  links: [
    { label: "Orders", path: "/admin/orders" },
    { label: "Delivery tasks", path: "/admin/delivery-tasks" },
  ],
  related: [
    { id: "track-order", title: "Track an order" },
    { id: "record-payment", title: "Record a payment" },
  ],
};
const SEARCH = {
  answer: "I could not find an exact guide. Closest topics:",
  sources: [{ id: "track-order", title: "Track an order" }],
  mode: "search",
  related: [{ id: "track-order", title: "Track an order" }],
  links: [{ label: "Orders", path: "/admin/orders" }],
};

async function openAndAsk(page: Page, role: Role, answer: unknown, width = 1280) {
  const queries: string[] = [];
  await page.setViewportSize({ width, height: 800 });
  await page.context().addCookies([
    { name: "ck_cookie_notice", value: "seen", url: ADMIN },
    { name: "ck_theme", value: "dark-cinematic", url: ADMIN },
  ]);
  await page.route("**/api/help/ask", async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    queries.push(body.query);
    await route.fulfill({ json: queries.length === 1 ? answer : SEARCH });
  });
  await loginAs(page, role);
  await page.goto(`${ADMIN}/dashboard`);
  await page.getByTestId("help-launcher").click();
  const panel = page.getByTestId("help-panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("textbox").fill("how do I ship an order");
  await panel.getByRole("textbox").press("Enter");
  await expect(page.getByTestId("help-rich")).toBeVisible();
  return { panel, queries };
}

const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

for (const role of ["staff", "admin"] as const) {
  test.describe(role, () => {
    test("renders summary, steps, tip, link buttons, related chips; link navigates and closes panel", async ({
      page,
    }) => {
      const { panel, queries } = await openAndAsk(page, role, RICH);
      await expect(page.getByTestId("help-summary")).toContainText("Mark an order shipped");
      expect(
        await page.getByTestId("help-summary").evaluate((e) => getComputedStyle(e).fontWeight),
      ).toMatch(/^(6|7)\d\d$/);
      await expect(page.getByTestId("help-steps").getByRole("listitem")).toHaveCount(3);
      await expect(page.getByTestId("help-tip")).toContainText("Tip");
      await expect(page.getByTestId("help-tip")).toContainText("delivery address");

      const buttons = page.getByTestId("help-links").getByRole("link");
      await expect(buttons).toHaveCount(2);
      await expect(buttons.first()).toHaveText(/Open Orders/);
      for (const i of [0, 1]) {
        const box = await buttons.nth(i).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      // keyboard focus ring
      await buttons.first().focus();
      expect(await buttons.first().evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none");

      // Related chip asks that topic
      await page
        .getByTestId("help-related")
        .getByRole("button", { name: "Track an order" })
        .click();
      await expect.poll(() => queries.length).toBe(2);
      expect(queries[1]).toBe("Track an order");
      await expect(page.getByTestId("help-answer")).toHaveCount(2);

      // Open Orders: same tab, panel closes, lands on the admin Orders screen
      const first = page.getByTestId("help-links").getByRole("link").first();
      await expect(first).not.toHaveAttribute("target", /.+/);
      await first.click();
      await expect(panel).toBeHidden();
      await expect(page).toHaveURL(/admin\.localhost:\d+\/orders/);
    });

    test("search mode shows honest text, related chips and a link", async ({ page }) => {
      await openAndAsk(page, role, SEARCH);
      await expect(page.getByTestId("help-answer")).toContainText(
        "I could not find an exact guide",
      );
      await expect(page.getByTestId("help-answer")).not.toContainText("see other topics");
      await expect(page.getByTestId("help-related").getByRole("button")).toHaveCount(1);
      await expect(page.getByTestId("help-links").getByRole("link")).toHaveCount(1);
    });
  });
}

test("320px: no overflow, buttons stay inside the panel, reduced motion respected", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { panel } = await openAndAsk(page, "admin", RICH, 320);
  await noOverflow(page);
  const p = await panel.boundingBox();
  for (const sel of ["help-links", "help-steps", "help-tip", "help-related"]) {
    const b = await page.getByTestId(sel).boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(p!.x - 1);
    expect(b!.x + b!.width).toBeLessThanOrEqual(p!.x + p!.width + 1);
  }
  const scrollW = await panel.evaluate((e) => {
    const sc = e.querySelector('[role="log"]') as HTMLElement | null;
    return sc ? sc.scrollWidth - sc.clientWidth : 0;
  });
  expect(scrollW).toBeLessThanOrEqual(0);
  const dur = await page
    .getByTestId("help-links")
    .getByRole("link")
    .first()
    .evaluate((e) => getComputedStyle(e).transitionDuration);
  // global reduced-motion rule shortens transitions to ~0 (1e-5s)
  expect(Math.max(...dur.split(",").map((d) => parseFloat(d)))).toBeLessThan(0.001);
});
