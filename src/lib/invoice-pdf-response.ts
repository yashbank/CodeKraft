import { AppError, ErrorCode } from "@/lib/errors";
import type { RequestContext } from "@/lib/authz/context";
import { getInvoiceDocument } from "@/modules/invoices/service";
import { buildInvoicePdf, fetchLogo } from "@/modules/invoices/pdf";

/** Renders the invoice PDF from current/stored seller details (per the site setting) and streams it. */
export async function invoicePdfResponse(
  getCtx: () => Promise<RequestContext>,
  id: string,
): Promise<Response> {
  try {
    const { props } = await getInvoiceDocument(await getCtx(), id);
    const pdf = buildInvoicePdf(props, await fetchLogo(props.seller.logo_url));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${props.invoiceNo.replace(/\//g, "-")}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    const status = err instanceof AppError && err.code === ErrorCode.UNAUTHENTICATED ? 401 : 404;
    return new Response("Not found", { status });
  }
}
