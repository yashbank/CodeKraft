import { redirect } from "next/navigation";

/** BUG-047 — `/payouts` was superseded by the combined "Partners & Payouts" screen. */
export default function AdminFinancePayoutsRedirectPage() {
  redirect("/admin/finance/partners");
}
