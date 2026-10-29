/** R9-12 — SEO proof: head tags, JSON-LD, OG image, sitemap, and the admin SEO preview. */
import { expect, test, type Page } from "@playwright/test";

import { ADMIN, expectNoOverflow, loginAs, q, SITE, WIDTHS } from "./helpers";

interface Target {
  kind: string;
  path: string;
  ldTypes: string[];
}

async function targets(): Promise<Target[]> {
  const [p] = await q<{ slug: string }>(
    `select slug from products where status = 'published' order by created_at limit 1`,
  );
  const [c] = await q<{ slug: string }>(
    `select slug from case_studies where published order by created_at limit 1`,
  );
  const [b] = await q<{ slug: string }>(
    `select b.slug from product_blogs b join products p on p.id = b.product_id
     where b.status = 'published' and p.status = 'published' order by b.created_at limit 1`,
  );
  const out: Target[] = [{ kind: "home", path: "/", ldTypes: ["Organization", "WebSite"] }];
  if (p) out.push({ kind: "product", path: `/products/${p.slug}`, ldTypes: ["Product"] });
  if (c) out.push({ kind: "case study", path: `/projects/${c.slug}`, ldTypes: ["Article"] });
  if (b) out.push({ kind: "blog", path: `/blog/${b.slug}`, ldTypes: ["BlogPosting"] });
  return out;
}

async function head(page: Page, path: string) {
  await page.goto(`${SITE}${path}`);
  const meta = (sel: string, attr = "content") => page.locator(sel).first().getAttribute(attr);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(
    (t) => {
      const j = JSON.parse(t);
      return Array.isArray(j) ? j : [j];
    },
  );
  return {
    title: await page.title(),
    description: await meta('meta[name="description"]'),
    canonical: await meta('link[rel="canonical"]', "href"),
    ogImage: await meta('meta[property="og:image"]'),
    ldTypes: ld.map((x) => x["@type"] as string),
  };
}

test.describe("R9-12 public SEO", () => {
  test("head tags, JSON-LD, OG image and sitemap for home/product/case study/blog", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const list = await targets();
    expect(list.length).toBeGreaterThanOrEqual(2);
    const sitemap = await (await request.get(`${SITE}/sitemap.xml`)).text();

    for (const t of list) {
      const h = await head(page, t.path);
      expect(h.title, `${t.kind} title`).toBeTruthy();
      expect(h.description, `${t.kind} description`).toBeTruthy();
      expect(new URL(h.canonical!).pathname, `${t.kind} canonical`).toBe(t.path);
      for (const type of t.ldTypes) expect(h.ldTypes, `${t.kind} JSON-LD`).toContain(type);

      // The og:image origin is the configured public URL; fetch the same path from the test site.
      expect(h.ogImage, `${t.kind} og:image`).toBeTruthy();
      const u = new URL(h.ogImage!, SITE);
      const img = await request.get(`${SITE}${u.pathname}${u.search}`);
      expect(img.status(), `${t.kind} og:image ${u.pathname}`).toBe(200);
      expect(img.headers()["content-type"]).toMatch(/^image\//);

      expect(sitemap, `${t.kind} in sitemap`).toContain(`${t.path === "/" ? "" : t.path}</loc>`);
    }
  });
});

test.describe("R9-12 admin SEO preview", () => {
  test("product editor preview matches the public title at 375/768/1280", async ({ page }) => {
    const [p] = await q<{ id: string; slug: string }>(
      `select id, slug from products where status = 'published' order by created_at limit 1`,
    );
    if (!p) throw new Error("needs a seeded published product");
    const seoTitle = "R9-12 Custom SEO Title";
    await q(`update products set seo_title = $1 where id = $2`, [seoTitle, p.id]);

    try {
      await loginAs(page, "super_admin");
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(`${ADMIN}/admin/products/${p.id}`);
        if (w < 1024) {
          // The admin editor is laptop-only: below 1024 the app shows a notice, not the editor.
          await expect(page.getByText(/designed for laptops/)).toBeVisible();
          await expectNoOverflow(page);
          continue;
        }
        await page.getByRole("tab", { name: "SEO" }).click();
        const preview = page.getByTestId("seo-preview");
        await expect(preview).toBeVisible();
        await expect(preview.getByTestId("seo-preview-title")).toContainText(seoTitle);
        await expect(preview.getByTestId("seo-preview-url")).toContainText(`/products/${p.slug}`);
        await expectNoOverflow(page);
      }
      // Same builder as the public page: the live <title> carries the same text. The seo_title was
      // written with SQL (no revalidation), so read the per-request render (currency cookie), not
      // the ISR copy cached for anonymous visitors.
      await page.context().addCookies([{ name: "ck_currency", value: "INR", url: SITE }]);
      await page.goto(`${SITE}/products/${p.slug}`);
      expect(await page.title()).toContain(seoTitle);
    } finally {
      await q(`update products set seo_title = null where id = $1`, [p.id]);
    }
  });
});
