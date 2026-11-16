/** P20-4: a video_embed product media row plays in a sandboxed allow-listed iframe, no CSP errors. */
import { expect, test } from "@playwright/test";
import { SITE, q } from "./helpers";

test("product video_embed renders a youtube-nocookie iframe", async ({ page }) => {
  const prod = (
    await q<{ id: string; slug: string }>(
      `select id, slug from products where status='published' order by created_at limit 1`,
    )
  )[0];
  test.skip(!prod, "no published product");
  const row = (
    await q<{ id: string }>(
      `insert into product_media (product_id, kind, embed_url, alt, position)
       values ($1, 'video_embed', 'https://youtu.be/dQw4w9WgXcQ', 'Demo video', 0) returning id`,
      [prod!.id],
    )
  )[0]!;
  try {
    const csp: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|frame-src/i.test(m.text())) csp.push(m.text());
    });
    // A currency cookie skips the ISR-cached /ssg twin, so the fresh row is rendered.
    await page.context().addCookies([{ name: "ck_currency", value: "INR", url: SITE }]);
    await page.goto(`${SITE}/products/${prod!.slug}`);
    const frame = page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
    await page.waitForTimeout(1500);
    expect(csp).toEqual([]);
  } finally {
    await q(`delete from product_media where id = $1`, [row.id]);
  }
});
