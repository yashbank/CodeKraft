import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (p.includes(`${path.sep}app${path.sep}dev`)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

/** Non-comment lines of a file that match `re`. */
function hits(file: string, re: RegExp): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && re.test(l))
    .map((l) => `${path.relative(ROOT, file)}: ${l.trim()}`);
}

describe("brand mark audit (P11-03)", () => {
  const ui = [...walk(path.join(ROOT, "components")), ...walk(path.join(ROOT, "app"))];

  it("no hard-coded brand asset paths or CK monograms in components/app", () => {
    const found = ui.flatMap((f) => hits(f, /["'`(]\/brand\/|>\s*CK\s*<|^\s*CK\s*$/));
    expect(found).toEqual([]);
  });

  it("site name is never a literal in auth (TOTP issuer / appName) or the 2FA setup URI", () => {
    const files = ["modules/auth/config.ts", "modules/users/service.ts"].map((f) =>
      path.join(ROOT, f),
    );
    expect(files.flatMap((f) => hits(f, /["'`]CodeKraft|totp\/CodeKraft/))).toEqual([]);
  });
});
