// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** P15-02 source scans: public pages stay ISR-able and client bundles stay light. */
const SRC = path.resolve(import.meta.dirname, "../../src");
const SITE = path.join(SRC, "app/(site)");
const read = (p: string) => readFileSync(p, "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("public routes are ISR, not force-dynamic", () => {
  const isr = [
    "ssg/page.tsx",
    "ssg/products/page.tsx",
    "ssg/products/[slug]/page.tsx",
    "services/page.tsx",
    "projects/page.tsx",
    "projects/[slug]/page.tsx",
    "legal/[slug]/page.tsx",
    "blog/page.tsx",
    "blog/[slug]/page.tsx",
  ];
  for (const f of isr) {
    it(`${f} exports revalidate and no force-dynamic`, () => {
      const s = read(path.join(SITE, f));
      expect(s).toMatch(/export const revalidate = \d+/);
      expect(s).not.toMatch(/force-dynamic|cookies\(\)|headers\(\)/);
    });
  }

  it("dynamic [slug] ISR pages opt in with generateStaticParams", () => {
    for (const f of ["ssg/products/[slug]", "projects/[slug]", "legal/[slug]", "blog/[slug]"]) {
      expect(read(path.join(SITE, f, "page.tsx"))).toMatch(
        /export (async )?function generateStaticParams/,
      );
    }
  });

  it("the ISR twins never read per-request data", () => {
    for (const f of walk(path.join(SITE, "ssg")))
      expect(read(f)).not.toMatch(/getSession|getDisplayCurrency/);
    expect(read(path.join(SITE, "_views/landing.tsx"))).not.toMatch(/getDisplayCurrency/);
  });
});

describe("client bundles stay light", () => {
  const heavy =
    /from "(@tiptap\/[^"]+|sanitize-html|exceljs|@\/modules\/content\/(render|sanitize))"/;
  const files = walk(SRC).filter((f) => /\.tsx?$/.test(f));
  it("no 'use client' module imports tiptap, sanitize-html, exceljs or content/render", () => {
    const bad = files.filter((f) => {
      const s = read(f);
      return /^\s*["']use client["']/.test(s) && heavy.test(s);
    });
    expect(bad.map((f) => path.relative(SRC, f))).toEqual([]);
  });
  it("components and view helpers use content/plain-text, not content/render", () => {
    const bad = files.filter(
      (f) =>
        /^(components|lib)\//.test(path.relative(SRC, f)) &&
        /modules\/content\/render"/.test(read(f)),
    );
    expect(bad.map((f) => path.relative(SRC, f))).toEqual([]);
  });
  it("exceljs is imported dynamically", () => {
    expect(read(path.join(SRC, "lib/admin/export-builder.ts"))).not.toMatch(
      /^import .* from "exceljs"/m,
    );
  });
});
