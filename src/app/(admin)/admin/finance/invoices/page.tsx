import { redirect } from "next/navigation";

/** BUG-047 — `/invoices` was superseded by "Reports & Statements" (partner statement exports). */
export default function AdminFinanceInvoicesRedirectPage() {
  redirect("/admin/finance/reports");
}
