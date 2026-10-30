import { redirect } from "next/navigation";

/** BUG-047 — bare /admin/finance has no index screen; land on the ledger (the default sub-page). */
export default function AdminFinanceIndexPage() {
  redirect("/admin/finance/ledger");
}
