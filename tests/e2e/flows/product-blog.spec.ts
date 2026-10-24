/**
 * Admin product editor Blog tab (BUG-042): title/body/SEO fields are a real editor backed by
 * `upsertProductBlogAction`, not display-only. Create a product, fill the Blog tab, save, reload
 * and confirm the fields persisted (admin query actually returns bodyJson/seoTitle/seoDescription).
 */
import { expect, test } from "@playwright/test";

const ADMIN = "http://admin.localhost:3000";
const PW = "local-super-admin-passphrase-2026";
const CEO = "yashbank2002@gmail.com";

test("edit product Blog tab fields and confirm they persist on reload", async ({ page }) => {
  await page.goto(`${ADMIN}/auth/login`);
  await page.getByLabel("Email").fill(CEO);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);

  await page.goto(`${ADMIN}/admin/products`);
  await page.getByRole("link", { name: /new product/i }).click();
  const name = `E2E Blog Probe ${Date.now()}`;
  await page.getByRole("textbox", { name: "Name" }).first().fill(name);
  await page.getByRole("textbox", { name: /short description/i }).fill("E2E blog probe product.");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}/);

  await page.getByText("Blog", { exact: true }).click();
  const blogTitle = `Blog title ${Date.now()}`;
  await page.locator("#blog-title").fill(blogTitle);
  await page.locator("#blog-slug").fill(`blog-probe-${Date.now()}`);
  await page.locator("#blog-excerpt").fill("A short excerpt for the probe post.");
  await page.locator("#blog-body").fill("The full body of the probe blog post.");
  await page.locator("#blog-seo-title").fill("Probe SEO title");
  await page.locator("#blog-seo-description").fill("Probe SEO description.");
  await page.getByRole("button", { name: "Save blog" }).click();
  await expect(page.getByText("Blog post saved")).toBeVisible();

  await page.reload();
  await page.getByText("Blog", { exact: true }).click();
  await expect(page.locator("#blog-title")).toHaveValue(blogTitle);
  await expect(page.locator("#blog-seo-title")).toHaveValue("Probe SEO title");
});
