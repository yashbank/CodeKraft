import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { invoicePdfResponse } from "@/lib/invoice-pdf-response";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return invoicePdfResponse(getAdminRequestContext, (await params).id);
}
