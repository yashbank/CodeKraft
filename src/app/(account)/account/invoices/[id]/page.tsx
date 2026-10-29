import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { getInvoiceDocument } from "@/modules/invoices/service";
import { InvoiceDocument } from "@/pdf/Invoice";

export const dynamic = "force-dynamic";

/** Printable HTML invoice (seller/brand follow the "Update old invoices" setting). */
export default async function InvoiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getInvoiceDocument(await getSiteRequestContext(), id).catch(() => null);
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="ck-no-print flex flex-wrap gap-3 text-body-sm">
        <Link href="/account/invoices" className="text-accent-text hover:underline">
          Back to invoices
        </Link>
        <a href={`/account/invoices/${id}/pdf`} className="text-accent-text hover:underline">
          Download PDF
        </a>
      </div>
      <InvoiceDocument {...doc.props} />
    </div>
  );
}
