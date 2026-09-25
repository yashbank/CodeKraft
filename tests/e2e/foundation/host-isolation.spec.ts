import { expect, test } from "@playwright/test";

const SITE = "http://localhost:3000";
const ADMIN = "http://admin.localhost:3000";

test.describe("host isolation (SA-05, docs/09 §3.5)", () => {
  test("/admin on the public host is 404", async ({ request }) => {
    const res = await request.get(`${SITE}/admin`);
    expect(res.status()).toBe(404);
  });
  test("admin host root shows the admin sign-in prompt and is noindex", async ({ page }) => {
    const res = await page.goto(`${ADMIN}/`);
    expect(res?.status()).toBe(200);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { name: "CodeKraft Admin" })).toBeVisible();
  });
  test("/api/health answers on both hosts", async ({ request }) => {
    for (const base of [SITE, ADMIN]) {
      const res = await request.get(`${base}/api/health`);
      expect(res.status()).toBe(200);
      expect((await res.json()).db).toBe("ok");
    }
  });
});
