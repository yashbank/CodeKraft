import { notFound } from "next/navigation";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getInvoiceDocument } from "@/modules/invoices/service";
import { InvoiceDocument } from "@/pdf/Invoice";

export const dynamic = "force-dynamic";

/** Admin printable HTML invoice (same renderer as the customer view). */
export default async function AdminInvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getInvoiceDocument(await getAdminRequestContext(), id).catch(() => null);
  if (!doc) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <a
        href={`/admin/finance/invoices/${id}/pdf`}
        className="ck-no-print text-body-sm text-accent-text hover:underline"
      >
        Download PDF
      </a>
      <InvoiceDocument {...doc.props} />
    </div>
  );
}
