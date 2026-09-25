/**
 * First-load JS budget for the public landing route (docs/10 §9, NFR-PERF-02): sums the gzipped
 * size of exactly the chunks Next lists for "/" in .next/app-build-manifest.json (what the
 * build table reports as "First Load JS"), instead of a glob that would count other routes' chunks.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const LIMIT_KB = Number(process.env.SIZE_LIMIT_FIRST_LOAD_KB ?? 200);
const manifestPath = ".next/app-build-manifest.json";
if (!existsSync(manifestPath)) {
  console.error("size-check: run `pnpm build` first (.next/app-build-manifest.json missing)");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  pages: Record<string, string[]>;
};
const key = Object.keys(manifest.pages).find((k) => /^\/(\([^)]+\)\/)?page$/.test(k));
if (!key) {
  console.error(
    "size-check: landing page entry not found in manifest",
    Object.keys(manifest.pages),
  );
  process.exit(1);
}
const files = manifest.pages[key] ?? [];
let total = 0;
const rows: Array<[number, string]> = [];
for (const f of files) {
  if (!f.endsWith(".js")) continue;
  const p = path.join(".next", f);
  if (!existsSync(p)) continue;
  const gz = gzipSync(readFileSync(p)).length;
  total += gz;
  rows.push([gz, f]);
}
rows.sort((a, b) => b[0] - a[0]);
for (const [gz, f] of rows) console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${f}`);
const kb = total / 1024;
console.log(`\nfirst-load JS for ${key}: ${kb.toFixed(1)} KB gzipped (limit ${LIMIT_KB} KB)`);
if (kb > LIMIT_KB) {
  console.error(`size-check: over budget by ${(kb - LIMIT_KB).toFixed(1)} KB`);
  process.exit(1);
}
