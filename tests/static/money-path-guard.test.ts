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
  "src/components/admin/format.ts": "helper (raw formatter for transaction-currency entry forms)",
  "src/components/site/_format.ts": "helper (site price(); callers pass converted money)",
  "src/lib/admin/currency-view.ts": "helper (viewer conversion)",
  "src/modules/offerings/pricing.ts": "helper (site pricing)",
  // legal / transaction-currency documents: stored currency primary, viewer shown as "≈" line
  "src/app/(account)/account/quotes/page.tsx": "legal quote amount + converted line",
  "src/components/account/PurchasesScreen.tsx": "legal order total",
  "src/components/account/OverviewScreen.tsx": "legal invoice amount",
  "src/components/account/PaymentInstructionsCard.tsx": "amount due in order currency",
  "src/components/account/PaymentInstructionsPanel.tsx": "amount due in order currency",
  "src/components/account/OrderStatusScreen.tsx": "legal order amounts",
  "src/components/account/WishlistScreen.tsx": "fromPrice already viewer-converted",
  "src/components/account/InvoicesScreen.tsx": "legal invoice amount + displayAmount",
  "src/components/account/CheckoutScreen.tsx": "checkout preview in viewer currency",
  "src/components/account/QuoteScreen.tsx": "legal quote amount + displayAmount",
  "src/components/account/SubscriptionCard.tsx": "subscription next due in billing currency",
  // server text
  "src/lib/admin/approval-text.ts": "approval payload amounts in their own currency",
  "src/lib/admin/finance-view.ts": "INR report cells",
  // dev showcase
  "src/app/dev/ui/sections/formatting.tsx": "dev UI formatting demo",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const IMPORT_FORMAT =
  /import\s*(?:type\s*)?\{[^}]*\bformat\b[^}]*\}\s*from\s*["']@\/lib\/money["']/;

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

  it("allowlist has no stale entries", () => {
    const stale = Object.keys(ALLOW).filter((f) => !IMPORT_FORMAT.test(readFileSync(f, "utf8")));
    expect(stale).toEqual([]);
  });
});
