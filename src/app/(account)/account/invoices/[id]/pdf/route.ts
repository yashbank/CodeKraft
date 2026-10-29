import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { invoicePdfResponse } from "@/lib/invoice-pdf-response";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return invoicePdfResponse(getSiteRequestContext, (await params).id);
}
