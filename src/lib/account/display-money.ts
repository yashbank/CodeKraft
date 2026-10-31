/** Server-only: viewer-currency secondary amount for stored-currency money (legal amounts stay unchanged). */
import type { Money } from "@/lib/money";
import { convertAmount } from "@/lib/rate-table";
import type { Currency } from "@/lib/money";

/** Converted copy of `m` in `viewer`, or undefined when currencies match or no rate exists. */
export async function toViewerMoney(m: Money, viewer: Currency): Promise<Money | undefined> {
  if (m.currency === viewer) return undefined;
  try {
    return {
      amountMinor: await convertAmount(m.amountMinor, m.currency, viewer),
      currency: viewer,
    };
  } catch {
    return undefined;
  }
}
