import { notFound } from "next/navigation";
import { EntitlementDetailScreen } from "@/components/account/EntitlementDetailScreen";
import { mapEntitlementDetail } from "@/lib/account/purchases-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { ErrorCode } from "@/lib/errors";
import { getMyEntitlementQuery } from "@/modules/entitlements/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * SCR-ACC-03 entitlement detail. `getMyEntitlement` (API-DEL-01) is scoped to `ctx.userId` and
 * returns `NOT_FOUND` for an id that doesn't exist or isn't the caller's -- a malformed (non-uuid)
 * `id` fails the same way via Zod `VALIDATION`, so both map to a real 404 rather than an error page.
 */
export default async function EntitlementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getSiteRequestContext();

  const result = await getMyEntitlementQuery({ entitlementId: id }, ctx);

  if (!result.ok) {
    if (result.error.code === ErrorCode.NOT_FOUND || result.error.code === ErrorCode.VALIDATION) {
      notFound();
    }
    throw new Error(result.error.message);
  }

  const entitlement = mapEntitlementDetail(result.data);

  return (
    <EntitlementDetailScreen
      entitlement={entitlement}
      links={{
        purchases: "/account/purchases",
        order:
          entitlement.orderNumber === "Manual grant"
            ? "/account/orders"
            : `/account/orders/${entitlement.orderNumber}`,
        invoice: entitlement.invoiceNumber ? "/account/invoices" : undefined,
        newQuery: "/account/queries",
        // "Buy again" / "Renew" send the customer back to the product page to start a fresh
        // checkout -- there's no per-entitlement renewal URL to link to directly, and this is a
        // real link rather than a fabricated one. Unpublished products (no `productHref`) fall
        // back to the catalog.
        renew: entitlement.productHref ?? "/products",
      }}
    />
  );
}
