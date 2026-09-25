import { expect, test } from "@playwright/test";

test.describe("theme attribute (docs/08 §10)", () => {
  test("server HTML carries data-theme before hydration", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<html[^>]*data-theme="dark-cinematic"/);
    expect(html).toContain("ck_theme");
  });
  test("a light-editorial cookie still renders dark while the flag is off", async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      { name: "ck_theme", value: "light-editorial", url: "http://localhost:3000" },
    ]);
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-cinematic");
    await ctx.close();
  });
});
