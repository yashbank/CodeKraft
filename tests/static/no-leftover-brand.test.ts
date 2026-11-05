import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (p.includes(`${path.sep}app${path.sep}dev`)) return []; // dev-only screens, not shipped
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

// Internal identifiers / brand defaults that may keep the old name. Anything else is a leak.
const ALLOW = [
  /codekraft\/no-/, // eslint rule names
  /__codekraftDb|codekraft-(local|public|private|documents|settings)|codekraft\.settings/, // keys, buckets, formats
  /phone\.codekraft\.invalid|anonymized\.codekraft\.dev|codekraft@upi/, // synthetic addresses
  /DEFAULT_SITE_NAME = "CodeKraft"|siteName: "CodeKraft"/, // the brand defaults themselves
  /Verify your CodeKraft|Reset your CodeKraft|Your CodeKraft login/, // brandSubject swaps in the site name at send
];

describe("no leftover CodeKraft brand in user-visible text (D17-07)", () => {
  it("only allow-listed internal identifiers mention CodeKraft in src", () => {
    const found = walk(SRC).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((l, i) => ({ l, at: `${path.relative(SRC, f)}:${i + 1}` }))
        .filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l) && /codekraft/i.test(l))
        .filter(({ l }) => !ALLOW.some((re) => re.test(l)))
        .map(({ l, at }) => `${at}: ${l.trim().slice(0, 100)}`),
    );
    expect(found).toEqual([]);
  });

  it("no hard-coded brand host in links", () => {
    const found = walk(SRC).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => /https?:\/\/[\w.-]*(codekraft|vercel\.app)/i.test(l))
        .map((l) => `${path.relative(SRC, f)}: ${l.trim()}`),
    );
    // middleware/auth only match *.vercel.app as a pattern, never build a link from it.
    expect(found.filter((x) => !/^(middleware|modules\/auth\/config)/.test(x))).toEqual([]);
  });
});
