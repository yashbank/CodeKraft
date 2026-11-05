// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.ADMIN_HOST = "admin.localhost:3000";
const APP = path.resolve(import.meta.dirname, "../../src/app");

let isNonceable: typeof import("../../src/middleware").isNonceable;
beforeAll(async () => {
  ({ isNonceable } = await import("../../src/middleware"));
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** URL of a page/layout file: route groups dropped, [param] -> "x". */
const urlOf = (f: string) =>
  "/" +
  path
    .relative(APP, path.dirname(f))
    .split(path.sep)
    .filter((seg) => !/^\(.*\)$/.test(seg))
    .join("/")
    .replace(/\[[^\]]+\]/g, "x");

describe("CSP: dynamic routes keep the strict nonce policy", () => {
  const files = walk(APP).filter(
    (f) =>
      /\/(page|layout)\.tsx$/.test(f) &&
      /export const dynamic = "force-dynamic"/.test(readFileSync(f, "utf8")),
  );
  it("finds force-dynamic files", () => expect(files.length).toBeGreaterThan(5));
  for (const f of files) {
    it(`${path.relative(APP, f)}`, () => {
      const url = urlOf(f).replace(/\/$/, "") || "/";
      const admin = f.includes(`${path.sep}(admin)${path.sep}`);
      // Admin pages are served on the admin host (strict for every path there).
      expect(isNonceable(url, admin ? "admin" : "site")).toBe(true);
    });
  }
  it("known dynamic routes", () => {
    for (const u of [
      "/search",
      "/products/x",
      "/products",
      "/",
      "/auth/login",
      "/auth/reset",
      "/auth/invite/t",
      "/auth/verify",
      "/auth/change-password",
    ])
      expect(isNonceable(u, "site"), u).toBe(true);
    expect(isNonceable("/", "site", true)).toBe(false);
    expect(isNonceable("/products/x", "site", true)).toBe(false);
    for (const u of ["/contact", "/legal/terms", "/blog/x", "/nope"])
      expect(isNonceable(u, "site"), u).toBe(false);
  });
});
