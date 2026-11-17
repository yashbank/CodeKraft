/**
 * P22-4: responsive audit. One test per role x width; inside it every main route of the role is
 * visited and ALL findings are collected (nothing fails on the first). Findings are also written to
 * test-results/p22/<role>-<width>.json so docs/P22-RESPONSIVE.md can be built from them.
 *
 * Checks per page: horizontal overflow, header/nav clipping + overlap, tap targets (<=768),
 * console errors, failed network calls, broken/overflowing images, unlabeled controls and inputs,
 * tiny inputs, sticky/fixed bars covering actions, clearly low contrast text (ratio < 3).
 * Local DB + stubs only (see helpers.ts).
 */
import fs from "node:fs";
import { expect, test, type Cookie, type Page } from "@playwright/test";

import { ADMIN, SITE, formLogin, loginAs, q, type Role } from "./helpers";

test.setTimeout(600_000);

const WIDTHS_ALL = [320, 375, 768, 1024, 1280, 1920] as const;
type RoleKey = "anonymous" | "customer" | "partner" | "staff" | "admin" | "super_admin";
const ROLES: RoleKey[] = ["anonymous", "customer", "partner", "staff", "admin", "super_admin"];
const PARTNER_EMAIL = "partner@codekraft.test";

interface Finding {
  role: RoleKey;
  route: string;
  width: number;
  severity: "high" | "medium" | "low";
  kind: string;
  detail: string;
}

async function one<T = string>(sql: string): Promise<T | undefined> {
  try {
    const rows = await q<Record<string, T>>(sql);
    const r = rows[0];
    return r ? (Object.values(r)[0] as T) : undefined;
  } catch {
    return undefined;
  }
}

interface Ids {
  productSlug?: string;
  productId?: string;
  caseSlug?: string;
  blogSlug?: string;
  offeringId?: string;
  buyerId?: string;
}

async function loadIds(): Promise<Ids> {
  return {
    productSlug: await one(
      `select slug from products where status='published' order by created_at limit 1`,
    ),
    productId: await one(`select id::text from products order by created_at limit 1`),
    caseSlug: await one(
      `select slug from case_studies where published order by created_at limit 1`,
    ),
    blogSlug: await one(`select slug from product_blogs limit 1`),
    offeringId: await one(`select id::text from offerings limit 1`),
    buyerId: await one(`select id::text from users where email='buyer@codekraft.test'`),
  };
}

function routesFor(role: RoleKey, ids: Ids): string[] {
  const opt = (v: string | undefined, f: (x: string) => string) => (v ? [f(v)] : []);
  if (role === "anonymous")
    return [
      "/",
      "/services",
      "/products",
      ...opt(ids.productSlug, (s) => `/products/${s}`),
      "/projects",
      ...opt(ids.caseSlug, (s) => `/projects/${s}`),
      "/blog",
      ...opt(ids.blogSlug, (s) => `/blog/${s}`),
      "/contact",
      "/legal/privacy",
      "/legal/terms",
      "/legal/refunds",
      "/legal/license",
      "/search?q=a",
      "/ssg",
      "/ssg/products",
      ...opt(ids.productSlug, (s) => `/ssg/products/${s}`),
      "/auth/login",
      "/auth/register",
      "/auth/reset",
      "/this-route-does-not-exist",
    ];
  if (role === "customer")
    return [
      "/account",
      "/account/purchases",
      "/account/invoices",
      "/account/queries",
      "/account/chat",
      "/account/quotes",
      "/account/wishlist",
      "/account/notifications",
      "/account/settings",
      ...opt(ids.offeringId, (s) => `/checkout/${s}`),
      "/",
      "/products",
      ...opt(ids.productSlug, (s) => `/products/${s}`),
      "/contact",
    ];
  // admin host routes (host rewrite: no /admin prefix). Same list for every back-office role;
  // role gating shows as a redirect / forbidden page, which is recorded as info, not a finding.
  const admin = [
    "/dashboard",
    "/approvals",
    "/notifications",
    "/products",
    ...opt(ids.productId, (s) => `/products/${s}`),
    "/categories",
    "/coupons",
    "/orders",
    "/orders/new",
    "/quotes",
    "/customers",
    ...opt(ids.buyerId, (s) => `/customers/${s}`),
    "/entitlements",
    "/delivery-tasks",
    "/leads",
    "/leads/board",
    "/queries",
    "/chatbot",
    "/finance",
    "/finance/ledger",
    "/finance/allocations",
    "/finance/partners",
    "/finance/payouts",
    "/finance/expenses",
    "/finance/adjustments",
    "/finance/invoices",
    "/finance/reports",
    "/content/landing",
    "/content/services",
    "/content/case-studies",
    "/content/testimonials",
    "/content/blog",
    "/content/faqs",
    "/content/legal",
    "/settings",
    "/audit",
    "/admin-users",
    "/email-preview",
  ];
  if (role === "partner")
    return admin.filter((r) => /^\/(dashboard|finance|notifications|approvals)/.test(r));
  if (role === "staff")
    return admin.filter((r) => !/^\/(finance|settings|audit|admin-users|email-preview)/.test(r));
  return admin;
}

// ---------------------------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------------------------
let partnerCookies: Cookie[] | undefined;
async function signIn(page: Page, role: RoleKey): Promise<void> {
  if (role === "anonymous") {
    await page.context().addCookies([{ name: "ck_cookie_notice", value: "seen", url: SITE }]);
    return;
  }
  if (role === "partner") {
    if (partnerCookies) {
      await page.context().addCookies(partnerCookies);
      const res = await page.request.get(`${ADMIN}/api/auth/get-session`);
      if (res.ok() && !["", "null"].includes((await res.text()).trim())) return;
      await page.context().clearCookies();
    }
    await formLogin(page, ADMIN, PARTNER_EMAIL);
    partnerCookies = await page.context().cookies();
    return;
  }
  await loginAs(page, role as Role);
  await page.context().addCookies([{ name: "ck_cookie_notice", value: "seen", url: SITE }]);
}

// ---------------------------------------------------------------------------------------------
// in-page audit (runs in the browser; returns plain findings)
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
            bar.getBoundingClientRect().top <= 200 && r.top < bar.getBoundingClientRect().bottom,
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
        if (fixedAnc && !fixedAnc.contains(el) && tcs.pointerEvents !== "none")
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
const ids: Ids = {};
const OUT = "test-results/p22";
const summary: Record<string, { pages: number; clean: number }> = {};

test.beforeAll(async () => {
  Object.assign(ids, await loadIds());
});

const baseOf = (role: RoleKey, route: string) =>
  `${role === "anonymous" || role === "customer" ? SITE : ADMIN}${route}`;

for (const role of ROLES) {
  for (const width of WIDTHS_ALL) {
    test(`responsive ${role} @${width}`, async ({ page }) => {
      const findings: Finding[] = [];
      const info: string[] = [];
      const height = width <= 480 ? 740 : width <= 768 ? 1024 : 900;
      await page.setViewportSize({ width, height });
      await signIn(page, role);
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
        const u = r.url();
        if (s >= 400 && !/\/_next\/webpack-hmr|favicon/.test(u))
          pageIssues.push({
            severity: s >= 500 ? "high" : "medium",
            kind: "network-fail",
            detail: `${s} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, "").slice(0, 120)}`,
          });
      });
      page.on("requestfailed", (r) => {
        const err = r.failure()?.errorText ?? "";
        if (/ERR_ABORTED/.test(err)) return;
        pageIssues.push({
          severity: "medium",
          kind: "request-failed",
          detail: `${err} ${r.url().slice(0, 120)}`,
        });
      });

      const routes = routesFor(role, ids);
      let clean = 0;
      for (const route of routes) {
        pageIssues = [];
        const url = baseOf(role, route);
        let status = 0;
        try {
          const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          status = res?.status() ?? 0;
          await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
          await page.waitForTimeout(250);
        } catch (e) {
          findings.push({
            role,
            route,
            width,
            severity: "high",
            kind: "navigation",
            detail: String(e).slice(0, 160),
          });
          continue;
        }
        const final = new URL(page.url());
        const asked = new URL(url);
        if (final.pathname !== asked.pathname)
          info.push(`${route} -> ${final.pathname}${final.search}`);
        if (status >= 400 && route !== "/this-route-does-not-exist")
          pageIssues.push({
            severity: status >= 500 ? "high" : "medium",
            kind: "http-status",
            detail: `${status} on document`,
          });
        const raw: Raw[] = [];
        try {
          const top = await auditPage(page, width);
          // A fixed/sticky bar over an input at scroll 0 on a scrollable page is cleared by
          // scrolling; the [bottom] pass below catches real end-of-page covers.
          const scrollable = await page.evaluate(
            () => document.documentElement.scrollHeight > window.innerHeight + 4,
          );
          raw.push(...top.filter((r) => !(scrollable && r.kind === "sticky-covers-action")));
          // bottom-of-page state for sticky bars
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
        for (const r of all) findings.push({ role, route, width, ...r });
      }
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(
        `${OUT}/${role}-${width}.json`,
        JSON.stringify(
          { role, width, pages: routes.length, clean, redirects: info, findings },
          null,
          1,
        ),
      );
      summary[`${role}@${width}`] = { pages: routes.length, clean };
      const high = findings.filter((f) => f.severity === "high");
      expect(
        high.map((f) => `${f.route} ${f.kind}: ${f.detail}`),
        `${role} @${width}: ${clean}/${routes.length} pages clean; ${findings.length} findings`,
      ).toEqual([]);
    });
  }
}
