/**
 * G18-3c guard: widgets stay fresh after relevant mutations because every admin mutation wrapper
 * revalidates the app layout on success (this clears the client router cache, so the dashboard
 * re-renders with new numbers). A new `admin-mutations.ts` without it would leave widgets stale.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODULES = path.resolve(__dirname, "../../src/modules");
// Read-only or self-refreshing wrappers: the audit viewer only reads, and the dashboard's own
// actions return their fresh data directly to the page that called them.
const EXEMPT = new Set(["audit", "dashboard-widgets"]);

describe("admin mutation wrappers revalidate the dashboard", () => {
  const files = fs
    .readdirSync(MODULES)
    .filter((m) => !EXEMPT.has(m))
    .map((m) => path.join(MODULES, m, "admin-mutations.ts"))
    .filter((f) => fs.existsSync(f));

  it("finds the wrappers", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it.each(files.map((f) => [path.relative(MODULES, f), f]))("%s calls revalidatePath", (_n, f) => {
    expect(fs.readFileSync(f as string, "utf8")).toMatch(/revalidatePath\(\s*["']\/(admin)?["']/);
  });
});
