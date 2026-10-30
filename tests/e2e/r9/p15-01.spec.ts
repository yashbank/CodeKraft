import { expect, test, type APIRequestContext } from "@playwright/test";

import { ADMIN, SITE, loginAs, q } from "./helpers";

/** 1x1 PNG (valid magic bytes) so the server's content sniffer accepts the upload. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0, 0, 1, 2, 3, 4]);

/**
 * These flows assume the dev "local" storage driver. If the server under test talks to a real
 * R2/S3 bucket (R2_* env), skip BEFORE any PUT so the spec never writes into a live bucket.
 */
async function needLocalDriver(req: APIRequestContext) {
  const r = await req.post(`${ADMIN}/api/files/upload-intent`, {
    data: { purpose: "site_logo", filename: "probe.png", mime: "image/png", sizeBytes: 1 },
  });
  const url = ((await r.json()).data?.uploadUrl ?? "") as string;
  test.skip(!url.startsWith("/api/files/local"), "server is not on the local storage driver");
}

/** Same three calls the admin UI makes: upload-intent -> PUT the minted URL -> complete. */
async function upload(
  req: APIRequestContext,
  purpose: string,
  file: string,
  mime: string,
  body: Buffer,
) {
  const i = await req.post(`${ADMIN}/api/files/upload-intent`, {
    data: { purpose, filename: file, mime, sizeBytes: body.length },
  });
  expect(i.status()).toBe(200);
  const intent = (await i.json()).data as {
    intentId: string;
    uploadUrl: string;
    objectKey: string;
  };
  const put = await req.put(
    intent.uploadUrl.startsWith("/") ? `${ADMIN}${intent.uploadUrl}` : intent.uploadUrl,
    { headers: { "content-type": mime }, data: body },
  );
  expect(put.ok()).toBeTruthy();
  const c = await req.post(`${ADMIN}/api/files/upload-intent/${intent.intentId}/complete`);
  expect(c.status()).toBe(200);
  const done = (await c.json()).data as { mediaId: string; url?: string };
  return { ...intent, ...done };
}

test.describe("P15-01 media: public vs private on the local driver", () => {
  test("site logo upload shows on the site, served immutable from the public path", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await loginAs(page, "super_admin");
    await needLocalDriver(page.request);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN}/admin/settings`);
    await page.waitForLoadState("networkidle"); // let React hydrate before the file input is used
    await page
      .locator("#st-logo")
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Logo updated")).toBeVisible({ timeout: 30_000 });
    try {
      const anon = await browser.newContext();
      const site = await anon.newPage();
      await site.goto(SITE);
      const logo = site.locator('img[src*="/api/files/public/media/"]').first();
      await expect(logo).toBeVisible();
      const src = (await logo.getAttribute("src"))!;
      const res = await anon.request.get(`${SITE}${new URL(src, SITE).pathname}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
      await anon.close();
    } finally {
      await q(`delete from site_settings where key = 'site_logo'`);
    }
  });

  test("product image is public (anonymous 200, immutable); release file is private", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await loginAs(page, "super_admin");
    await needLocalDriver(page.request);
    const created: { media: string[]; ent?: string; version?: string } = { media: [] };
    const anon = await browser.newContext();
    const buyer = await browser.newContext();
    try {
      // --- public: product image
      const img = await upload(page.request, "product_image", "cover.png", "image/png", PNG);
      created.media.push(img.mediaId);
      expect(img.url).toContain(`/api/files/public/${img.objectKey}`);
      const pub = await anon.request.get(`${SITE}${new URL(img.url!, SITE).pathname}`);
      expect(pub.status()).toBe(200);
      expect(pub.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
      expect(pub.headers()["content-type"]).toBe("image/png");

      // --- private: release file
      const rel = await upload(page.request, "release_file", "app.zip", "application/zip", ZIP);
      created.media.push(rel.mediaId);
      expect(rel.url).toBeUndefined();
      // not reachable through the public path, nor the admin-only signed-link route
      expect((await anon.request.get(`${SITE}/api/files/public/${rel.objectKey}`)).status()).toBe(
        404,
      );
      expect((await anon.request.get(`${SITE}/api/files/private/${rel.mediaId}`)).status()).toBe(
        401,
      );

      // entitled customer: fixture entitlement on a download offering
      const [off] = await q<{ id: string; product_id: string }>(
        `select o.id, o.product_id from offerings o join products p on p.id = o.product_id
         where o.delivery_type = 'download' and p.status = 'published' limit 1`,
      );
      test.skip(!off, "no published download offering in the local seed");
      const [u] = await q<{ id: string }>(
        `select id from users where email = 'buyer@codekraft.test'`,
      );
      created.version = `p15-01-${Date.now()}`;
      await q(`insert into release_files (product_id, version, media_id) values ($1,$2,$3)`, [
        off!.product_id,
        created.version,
        rel.mediaId,
      ]);
      const [ent] = await q<{ id: string }>(
        `insert into entitlements (user_id, offering_id, product_id, delivery_type, status,
           access_starts_at, update_policy, download_cap, downloads_used, provisioning_state)
         values ($1,$2,$3,'download','active', now(), 'all_free', 5, 0, 'n/a') returning id`,
        [u!.id, off!.id, off!.product_id],
      );
      created.ent = ent!.id;

      const url = `${SITE}/api/files/download/${ent!.id}/${rel.mediaId}`;
      expect((await anon.request.get(url, { maxRedirects: 0 })).status()).toBe(401);

      await loginAs(await buyer.newPage(), "customer");
      const ok = await buyer.request.get(url, { maxRedirects: 0 });
      expect(ok.status()).toBe(302);
      const signed = `${SITE}${new URL(ok.headers().location!, SITE).pathname}${new URL(ok.headers().location!, SITE).search}`;
      const file = await anon.request.get(signed); // the 5-minute signed link carries the access
      expect(file.status()).toBe(200);
      expect(Buffer.from(await file.body()).equals(ZIP)).toBe(true);
      // a tampered signature is refused
      const bad = new URL(signed);
      bad.searchParams.set("sig", "00".repeat(32));
      expect((await anon.request.get(bad.toString())).status()).toBe(403);
    } finally {
      if (created.ent) await q(`delete from entitlements where id = $1`, [created.ent]);
      if (created.version)
        await q(`delete from release_files where version = $1`, [created.version]);
      if (created.media.length)
        await q(`delete from media where id = any($1::uuid[])`, [created.media]);
      await anon.close();
      await buyer.close();
    }
  });
});
