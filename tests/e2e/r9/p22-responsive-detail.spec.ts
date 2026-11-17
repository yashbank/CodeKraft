/**
 * P22-5b: responsive audit of the customer ACCOUNT detail pages that the seed has no rows for:
 * /account/orders/[no], /account/purchases/[id], /account/invoices/[id], /account/queries/[id].
 * Rows are seeded into the LOCAL DB first (idempotent; helpers.q refuses non-local URLs).
 * The in-page audit below is the same logic as p22-responsive.spec.ts (copied: that spec cannot be
 * imported without registering its tests). All findings are collected per width; only `high` fail.
 * Output: test-results/p22/detail-<width>.json.
 */
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

import { SITE, loginAs, q } from "./helpers";

test.setTimeout(300_000);

const WIDTHS_ALL = [320, 375, 768, 1024, 1280, 1920] as const;

interface Finding {
  route: string;
  width: number;
  severity: "high" | "medium" | "low";
  kind: string;
  detail: string;
}

const BILL = { name: "Buyer Test", email: "buyer@codekraft.test", country: "IN", state_code: "KA" };

const doc = (t: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  });

/** Idempotent local seed for buyer@codekraft.test: 2 orders, 1 entitlement, 1 invoice, 1 query. */
async function seedDetailRows(): Promise<{
  orderNo: string;
  entitlementId: string;
  invoiceId: string;
  queryId: string;
}> {
  const [user] = await q<{ id: string }>(`select id from users where email='buyer@codekraft.test'`);
  const [off] = await q<{ id: string; product_id: string }>(
    `select id, product_id from offerings limit 1`,
  );
  if (!user || !off) throw new Error("seed users/offerings missing");

  const mkOrder = async (no: string, status: string, paid: boolean): Promise<string> => {
    const [ex] = await q<{ id: string }>(`select id from orders where order_no=$1`, [no]);
    if (ex) return ex.id;
    const [o] = await q<{ id: string }>(
      `insert into orders (order_no, type, user_id, status, currency, subtotal_minor, tax_minor, total_minor,
         billing_snapshot, fx_rate_to_inr, paid_at)
       values ($1,'product',$2,$3,'INR',1000000,180000,1180000,$4::jsonb,1,$5) returning id`,
      [no, user.id, status, JSON.stringify(BILL), paid ? new Date().toISOString() : null],
    );
    await q(
      `insert into order_items (order_id, offering_id, product_id, description, quantity, unit_minor, total_minor)
       values ($1,$2,$3,$4,1,1000000,1000000)`,
      [
        o!.id,
        off.id,
        off.product_id,
        "FitDesk Pro - Standard licence with a deliberately long description to test wrapping",
      ],
    );
    return o!.id;
  };
  const paidId = await mkOrder("CK-ORD-900001", "fulfilled", true);
  await mkOrder("CK-ORD-900002", "pending_payment", false);

  let [ent] = await q<{ id: string }>(`select id from entitlements where user_id=$1 limit 1`, [
    user.id,
  ]);
  if (!ent)
    [ent] = await q<{ id: string }>(
      `insert into entitlements (user_id, offering_id, product_id, delivery_type, status, update_policy, access_starts_at)
       values ($1,$2,$3,'download','active','all_free', now()) returning id`,
      [user.id, off.id, off.product_id],
    );

  let [inv] = await q<{ id: string }>(`select id from invoices where order_id=$1`, [paidId]);
  if (!inv)
    [inv] = await q<{ id: string }>(
      `insert into invoices (invoice_no, order_id, fy, seq, issued_at, seller_snapshot, buyer_snapshot, lines,
         subtotal_minor, tax_minor, total_minor, currency)
       values ('CK/P22/0001',$1,'2026-27',9001, now(), $2::jsonb, $3::jsonb, $4::jsonb, 1000000,180000,1180000,'INR')
       returning id`,
      [
        paidId,
        JSON.stringify({
          name: "CodeKraft",
          address: "Bengaluru, KA",
          gst_number: null,
          email: "a@b.co",
          phone: null,
          state_code: "KA",
          logo_url: null,
        }),
        JSON.stringify({ ...BILL, company: null, address: null, gst_number: null }),
        JSON.stringify([
          {
            description: "FitDesk Pro - Standard licence",
            quantity: 1,
            unit_minor: 1000000,
            discount_minor: 0,
            tax_minor: 180000,
            total_minor: 1180000,
          },
        ]),
      ],
    );

  let [qr] = await q<{ id: string }>(`select id from queries where user_id=$1 limit 1`, [user.id]);
  if (!qr) {
    [qr] = await q<{ id: string }>(
      `insert into queries (user_id, subject, source, status)
       values ($1,'Licence key not received after payment','dashboard','open') returning id`,
      [user.id],
    );
    await q(
      `insert into query_messages (query_id, author_id, author_kind, body_json) values ($1,$2,'customer',$3::jsonb)`,
      [
        qr!.id,
        user.id,
        doc(
          "I paid yesterday but have not got my key. Order CK-ORD-900001. Please help me as soon as you can.",
        ),
      ],
    );
    await q(
      `insert into query_messages (query_id, author_kind, body_json) values ($1,'admin',$2::jsonb)`,
      [qr!.id, doc("Thanks, we are checking this now.")],
    );
  }
  return { orderNo: "CK-ORD-900001", entitlementId: ent!.id, invoiceId: inv!.id, queryId: qr!.id };
}

// ---------------------------------------------------------------------------------------------
// in-page audit (same logic as p22-responsive.spec.ts)
// ---------------------------------------------------------------------------------------------
type Raw = { severity: Finding["severity"]; kind: string; detail: string };

async function auditPage(page: Page, width: number): Promise<Raw[]> {
  return page.evaluate((w): Raw[] => {
    const out: Raw[] = [];
    const add = (severity: Raw["severity"], kind: string, detail: string) =>
      out.push({ severity, kind, detail: detail.slice(0, 220) });
    const desc = (el: Element) => {
      const e = el as HTMLElement;
      const t = (e.getAttribute("aria-label") ?? e.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 28);
      const cls =
        typeof e.className === "string" ? e.className.split(/\s+/).slice(0, 2).join(".") : "";
      return `${el.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${cls ? "." + cls : ""}${t ? ` "${t}"` : ""}`;
    };
    const visible = (el: Element) => {
      const e = el as HTMLElement;
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0)
        return false;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      if (e.closest("[inert],[hidden],[aria-hidden='true']")) return false;
      return true;
    };
    const srOnly = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width <= 2 || r.height <= 2;
    };
    const inScrollX = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true;
      }
      return false;
    };
    const iw = window.innerWidth;
    const ih = window.innerHeight;

    // 1. horizontal overflow
    const de = document.documentElement;
    if (de.scrollWidth > iw + 1 || document.body.scrollWidth > iw + 1) {
      const offenders: string[] = [];
      for (const el of document.querySelectorAll("body *")) {
        if (offenders.length >= 4) break;
        if (!visible(el) || inScrollX(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") continue;
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.right > iw + 1 && r.left < iw)
          offenders.push(`${desc(el)} right=${Math.round(r.right)}`);
      }
      add(
        "high",
        "overflow-x",
        `scrollWidth ${Math.max(de.scrollWidth, document.body.scrollWidth)} > ${iw}; ${offenders.join(" | ")}`,
      );
    }

    // 2. header/nav clipping and overlap
    const bars = [
      ...document.querySelectorAll("header, nav, [role=banner], [role=navigation]"),
    ].filter(visible);
    const leaves: HTMLElement[] = [];
    for (const bar of bars) {
      for (const el of bar.querySelectorAll<HTMLElement>("a,button,span,h1,h2,p,input")) {
        if (!visible(el) || srOnly(el)) continue;
        if (el.children.length > 0 && !/^(A|BUTTON)$/.test(el.tagName)) continue;
        if (!(el.textContent ?? "").trim() && el.tagName !== "INPUT") continue;
        leaves.push(el);
      }
    }
    const seenLeaf = [...new Set(leaves)];
    let clipped = 0;
    for (const el of seenLeaf) {
      const cs = getComputedStyle(el);
      const hides = cs.overflowX === "hidden" || cs.overflowX === "clip";
      if (
        hides &&
        cs.textOverflow !== "ellipsis" &&
        el.scrollWidth > el.clientWidth + 2 &&
        clipped++ < 3
      )
        add(
          "medium",
          "nav-clipped",
          `${desc(el)} text clipped (${el.scrollWidth}>${el.clientWidth})`,
        );
      const r = el.getBoundingClientRect();
      if ((r.right > iw + 1 || r.left < -1) && !inScrollX(el) && clipped++ < 3)
        add(
          "high",
          "nav-offscreen",
          `${desc(el)} outside viewport (${Math.round(r.left)}..${Math.round(r.right)})`,
        );
    }
    let overlaps = 0;
    for (let i = 0; i < seenLeaf.length && overlaps < 3; i++) {
      for (let j = i + 1; j < seenLeaf.length && overlaps < 3; j++) {
        const a = seenLeaf[i]!;
        const b = seenLeaf[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 4 && oy > 4) {
          overlaps++;
          add(
            "high",
            "nav-overlap",
            `${desc(a)} overlaps ${desc(b)} (${Math.round(ox)}x${Math.round(oy)}px)`,
          );
        }
      }
    }

    // 3. tap targets <=768
    const ctl =
      "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=menuitem],summary";
    if (w <= 768) {
      const small: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(ctl)) {
        if (!visible(el) || srOnly(el)) continue;
        if (el.closest("[data-nextjs-dialog-overlay],nextjs-portal")) continue;
        if (el.matches("input[type=checkbox],input[type=radio]") && el.closest("label")) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
        if (r.height >= 40 && r.width >= 40) continue;
        // WCAG exempts inline links inside running text.
        if (
          el.tagName === "A" &&
          getComputedStyle(el).display === "inline" &&
          el.parentElement &&
          (el.parentElement.textContent ?? "").trim().length >
            (el.textContent ?? "").trim().length + 12
        )
          continue;
        // skip links that only appear on focus
        if (/skip/i.test(el.textContent ?? "") && r.top < 0) continue;
        small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      if (small.length)
        add(
          small.length > 8 ? "medium" : "low",
          "tap-target<40",
          `${small.length} controls: ${small.slice(0, 4).join(" | ")}`,
        );
    }

    // 6. images
    const badImgs: string[] = [];
    let noAlt = 0;
    for (const img of document.querySelectorAll<HTMLImageElement>("img")) {
      if (!visible(img)) continue;
      const r = img.getBoundingClientRect();
      if (img.complete && img.naturalWidth === 0 && img.currentSrc)
        badImgs.push(`broken ${desc(img)}`);
      else if ((r.right > iw + 1 || r.width > iw + 1) && !inScrollX(img))
        badImgs.push(`overflow ${desc(img)} ${Math.round(r.width)}w`);
      if (!img.hasAttribute("alt")) noAlt++;
    }
    if (badImgs.length) add("high", "image", badImgs.slice(0, 3).join(" | "));
    if (noAlt) add("low", "a11y-img-alt", `${noAlt} <img> without alt attribute`);

    // forms + labels
    const accName = (el: HTMLElement): string => {
      const aria = el.getAttribute("aria-label")?.trim();
      if (aria) return aria;
      const lb = el.getAttribute("aria-labelledby");
      if (
        lb &&
        lb.split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim())
      )
        return "labelledby";
      if (el.getAttribute("title")?.trim()) return "title";
      const lbls = (el as HTMLInputElement).labels;
      if (lbls && [...lbls].some((l) => (l.textContent ?? "").trim())) return "label";
      if (el.closest("label") && (el.closest("label")!.textContent ?? "").trim()) return "label";
      if ((el.textContent ?? "").trim()) return "text";
      if (el.querySelector("img[alt]:not([alt=''])")) return "imgalt";
      if (el.querySelector("svg title")) return "svgtitle";
      return "";
    };
    const unlabeledInputs: string[] = [];
    const tinyInputs: string[] = [];
    for (const el of document.querySelectorAll<HTMLInputElement>(
      "input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea",
    )) {
      if (!visible(el) || srOnly(el)) continue;
      const nm = accName(el) || (el.getAttribute("placeholder") ? "" : "");
      if (!nm) unlabeledInputs.push(desc(el) + ` type=${el.type ?? ""}`);
      const r = el.getBoundingClientRect();
      if (!/checkbox|radio|range|file/.test(el.type) && r.width < 100 && !inScrollX(el))
        tinyInputs.push(`${desc(el)} ${Math.round(r.width)}w`);
      if (r.right > iw + 1 && !inScrollX(el)) tinyInputs.push(`${desc(el)} extends past viewport`);
    }
    if (unlabeledInputs.length)
      add(
        "medium",
        "a11y-input-label",
        `${unlabeledInputs.length}: ${unlabeledInputs.slice(0, 3).join(" | ")}`,
      );
    if (tinyInputs.length) add("medium", "form-input-size", tinyInputs.slice(0, 3).join(" | "));
    const unnamed: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a[href],button,[role=button]")) {
      if (!visible(el)) continue;
      if (!accName(el)) unnamed.push(desc(el));
    }
    if (unnamed.length)
      add(
        "medium",
        "a11y-no-name",
        `${unnamed.length} links/buttons without name: ${unnamed.slice(0, 3).join(" | ")}`,
      );

    // tables
    for (const t of document.querySelectorAll("table")) {
      if (!visible(t)) continue;
      const r = t.getBoundingClientRect();
      let scroller: HTMLElement | null = null;
      for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll") {
          scroller = p;
          break;
        }
      }
      if (r.width > iw + 1 && !scroller)
        add(
          "high",
          "table-overflow",
          `${desc(t)} ${Math.round(r.width)}w wider than viewport, no scroll container`,
        );
      else if (
        scroller &&
        w <= 768 &&
        scroller.scrollWidth > scroller.clientWidth + 1 &&
        !scroller.matches("[tabindex]")
      )
        add(
          "low",
          "table-scroll-not-focusable",
          `${desc(t)} scrolls horizontally but container has no tabindex`,
        );
    }

    // 7. fixed/sticky bars
    const bars2: HTMLElement[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < iw * 0.6) continue; // vertical sidebars and small floating widgets are not bars
      bars2.push(el);
    }
    const pinned = bars2.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= 1 || r.bottom >= ih - 1;
    });
    const pinnedH = pinned
      .filter((e) => !pinned.some((o) => o !== e && o.contains(e)))
      .reduce((s, e) => s + e.getBoundingClientRect().height, 0);
    if (pinnedH > ih * 0.3)
      add(
        "high",
        "sticky-too-tall",
        `fixed/sticky bars take ${Math.round(pinnedH)}px of ${ih}px viewport: ${pinned.slice(0, 3).map(desc).join(" | ")}`,
      );
    const allFixed = [...document.querySelectorAll<HTMLElement>("body *")].filter(
      (el) => getComputedStyle(el).position === "fixed" && visible(el),
    );
    const covered: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(ctl)) {
      if (covered.length >= 4) break;
      if (!visible(el) || srOnly(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= ih || r.right <= 0 || r.left >= iw) continue;
      if (
        /^skip/i.test(el.textContent ?? "") ||
        el.closest("aside") ||
        pinned.some(
          (bar) =>
            bar.getBoundingClientRect().top <= 1 && r.top < bar.getBoundingClientRect().bottom,
        ) || // scrolled under the sticky top bar: reachable by scrolling
        allFixed.some((f) => f.contains(el)) ||
        el.closest("[style*='position: sticky'],header,nav")
      )
        continue;
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), iw - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), ih - 1);
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el)) {
        const tcs = getComputedStyle(top);
        let fixedAnc: Element | null = top;
        while (
          fixedAnc &&
          getComputedStyle(fixedAnc).position !== "fixed" &&
          getComputedStyle(fixedAnc).position !== "sticky"
        )
          fixedAnc = fixedAnc.parentElement;
        // Differs from p22-responsive.spec.ts: a bottom-pinned bar over content that is not scrolled
        // to the end only hides it until the user scrolls. The strict [bottom] pass covers the bar.
        const fr = fixedAnc?.getBoundingClientRect();
        const reachableByScroll =
          !!fr && fr.top > ih / 2 && window.scrollY + ih < de.scrollHeight - 1;
        if (
          fixedAnc &&
          !fixedAnc.contains(el) &&
          tcs.pointerEvents !== "none" &&
          !reachableByScroll
        )
          covered.push(`${desc(el)} covered by ${desc(fixedAnc)}`);
      }
    }
    if (covered.length) add("high", "sticky-covers-action", covered.join(" | "));

    // 8. contrast (obviously low only)
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1]!.split(/[ ,/]+/).map(Number);
      return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] ?? 1 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element): { r: number; g: number; b: number } | null => {
      for (let p: Element | null = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.backgroundImage !== "none") return null; // unknown backdrop
        const c = parse(cs.backgroundColor);
        if (c && c.a >= 0.95) return c;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const low: string[] = [];
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>(
      "p,span,a,li,td,th,h1,h2,h3,h4,label,button,small,div",
    )) {
      if (n > 400 || low.length >= 4) break;
      if (
        ![...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 2)
      )
        continue;
      if (!visible(el)) continue;
      n++;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = bgOf(el);
      if (!fg || !bg || fg.a < 0.95 || Number(cs.opacity) < 1) continue;
      const l1 = lum(fg),
        l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (
        ratio < 3 &&
        !(el as HTMLButtonElement).disabled &&
        !el.closest("[aria-disabled=true],[disabled]")
      )
        low.push(`${desc(el)} ratio ${ratio.toFixed(2)}`);
    }
    if (low.length) add("low", "a11y-contrast", low.join(" | "));

    return out;
  }, width);
}

// ---------------------------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------------------------
const OUT = "test-results/p22";
let routes: string[] = [];

test.beforeAll(async () => {
  const r = await seedDetailRows();
  routes = [
    `/account/orders/${r.orderNo}`,
    "/account/orders/CK-ORD-900002",
    `/account/purchases/${r.entitlementId}`,
    `/account/invoices/${r.invoiceId}`,
    `/account/queries/${r.queryId}`,
  ];
});

for (const width of WIDTHS_ALL) {
  test(`responsive account detail @${width}`, async ({ page }) => {
    const findings: Finding[] = [];
    const height = width <= 480 ? 740 : width <= 768 ? 1024 : 900;
    await page.setViewportSize({ width, height });
    await loginAs(page, "customer");
    await page.context().addCookies([{ name: "ck_cookie_notice", value: "seen", url: SITE }]);
    await page.setViewportSize({ width, height });

    let pageIssues: Raw[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !/Failed to load resource/.test(t))
        pageIssues.push({ severity: "high", kind: "console-error", detail: t.slice(0, 180) });
    });
    page.on("pageerror", (e) =>
      pageIssues.push({ severity: "high", kind: "page-error", detail: e.message.slice(0, 180) }),
    );
    page.on("response", (r) => {
      const s = r.status();
      if (s >= 400 && !/\/_next\/webpack-hmr|favicon/.test(r.url()))
        pageIssues.push({
          severity: s >= 500 ? "high" : "medium",
          kind: "network-fail",
          detail: `${s} ${r.request().method()} ${r
            .url()
            .replace(/^https?:\/\/[^/]+/, "")
            .slice(0, 120)}`,
        });
    });

    let clean = 0;
    for (const route of routes) {
      pageIssues = [];
      const res = await page.goto(`${SITE}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
      await page.waitForTimeout(250);
      const status = res?.status() ?? 0;
      if (status >= 400)
        pageIssues.push({ severity: "high", kind: "http-status", detail: `${status} on document` });
      if (new URL(page.url()).pathname !== route)
        pageIssues.push({
          severity: "high",
          kind: "redirect",
          detail: `-> ${new URL(page.url()).pathname}`,
        });
      const raw: Raw[] = [];
      try {
        raw.push(...(await auditPage(page, width)));
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(150);
        const bottom = (await auditPage(page, width)).filter((r) => /^sticky-/.test(r.kind));
        for (const b of bottom)
          if (!raw.some((r) => r.kind === b.kind))
            raw.push({ ...b, detail: `[bottom] ${b.detail}` });
      } catch (e) {
        raw.push({ severity: "medium", kind: "audit-error", detail: String(e).slice(0, 140) });
      }
      const all = [...raw, ...pageIssues];
      if (all.length === 0) clean++;
      for (const r of all) findings.push({ route, width, ...r });
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      `${OUT}/detail-${width}.json`,
      JSON.stringify({ width, pages: routes.length, clean, findings }, null, 1),
    );
    const high = findings.filter((f) => f.severity === "high");
    expect(
      high.map((f) => `${f.route} ${f.kind}: ${f.detail}`),
      `detail @${width}: ${clean}/${routes.length} pages clean; ${findings.length} findings`,
    ).toEqual([]);
  });
}
