import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * C16-03 guard: money text comes from the one conversion path (modules/fx/convert, useAdminMoney,
 * MoneyCell, offerings/pricing). Importing `format` from "@/lib/money" is only allowed in the
 * files below. Adding a file here needs a reason: the amount is already in the viewer currency,
 * or it is a legal document / transaction-currency amount that must stay as posted.
 */
const ALLOW: Record<string, string> = {
  // approved helpers
  "src/components/admin/MoneyCell.tsx": "helper (viewer conversion)",
  "src/components/admin/AdminCurrency.tsx": "helper (viewer conversion)",
  "src/components/admin/format.ts":
    "helper (raw formatter; only the payment-confirm and manual-order entry forms use it)",
  "src/components/site/_format.ts": "helper (site price(); callers pass converted money)",
  "src/lib/admin/currency-view.ts": "helper (viewer conversion)",
  "src/lib/document-money.ts": "helper (document/PDF money text and approx notes)",
  "src/modules/offerings/pricing.ts": "helper (site pricing)",
  "src/components/account/ViewerMoney.tsx": "helper (viewer conversion for account/checkout)",
  // legal / transaction-currency documents: stored currency primary, viewer shown as "≈" line
  "src/app/(account)/account/quotes/page.tsx": "legal quote amount + approx viewer line",
  "src/components/account/OverviewScreen.tsx": "legal invoice amount (stored currency)",
  "src/components/account/PaymentInstructionsCard.tsx":
    "amount the customer must pay, in the charge currency",
  "src/components/account/PaymentInstructionsPanel.tsx":
    "amount the customer must pay, in the charge currency",
  "src/components/account/WishlistScreen.tsx":
    "fromPrice already converted server-side (cardFromPrice)",
  "src/components/account/InvoicesScreen.tsx": "legal invoice amount + approx viewer line",
  "src/components/account/QuoteScreen.tsx": "legal quote amount + approx viewer line",
  // server text
  "src/lib/admin/approval-text.ts": "approval text states the amount in the currency requested",
  // dev showcase
  "src/app/dev/ui/sections/formatting.tsx": "dev-only formatting demo",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

// `format` (also as `format as formatMoney`) imported from lib/money, by alias or relative path.
const IMPORT_FORMAT =
  /import\s*(?:type\s*)?\{[^}]*\bformat\b[^}]*\}\s*from\s*["'](?:@\/lib\/|\.{1,2}\/(?:\.\.\/)*)money["']/;
// Home-grown currency formatting: Intl currency style (only lib/money and currency-prefs may).
const RAW_INTL = /style:\s*["']currency["']/;
const RAW_INTL_ALLOW = new Set(["src/lib/money.ts", "src/lib/currency-prefs.ts"]);

describe("money path guard (C16-03)", () => {
  it("only allowlisted files import format from @/lib/money", () => {
    const offenders = walk("src")
      .map((f) => relative(".", f))
      .filter((f) => f !== "src/lib/money.ts")
      .filter((f) => IMPORT_FORMAT.test(readFileSync(f, "utf8")) && !(f in ALLOW));
    expect(
      offenders,
      "use useAdminMoney/MoneyCell/displayMoney or allowlist with a reason",
    ).toEqual([]);
  });

  it("no raw Intl currency formatting outside lib/money and currency-prefs", () => {
    const offenders = walk("src")
      .map((f) => relative(".", f))
      .filter((f) => RAW_INTL.test(readFileSync(f, "utf8")) && !RAW_INTL_ALLOW.has(f));
    expect(offenders).toEqual([]);
  });

  it("allowlist has no stale entries", () => {
    const stale = Object.keys(ALLOW).filter((f) => !IMPORT_FORMAT.test(readFileSync(f, "utf8")));
    expect(stale).toEqual([]);
  });
});
