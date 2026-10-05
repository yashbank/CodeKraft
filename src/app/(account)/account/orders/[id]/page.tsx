import { notFound } from "next/navigation";
import { OrderStatusScreen } from "@/components/account/OrderStatusScreen";
import { mapOrderDetailToOrderView } from "@/lib/account/order-detail-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { ErrorCode } from "@/lib/errors";
import { getMyOrderQuery } from "@/modules/orders/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  // The public order number (`CK-ORD-000001`), matching `getMyOrder`'s input and the href the
  // Purchases list builds (`mapOrderSummaryView`'s `id`) -- not the internal order uuid.
  params: Promise<{ id: string }>;
}

/**
 * SCR-ACC-11 order status. `getMyOrder` (API-COM-05) is scoped to `orders.user_id = ctx.userId`
 * and returns `NOT_FOUND` for an order number that doesn't exist or isn't the caller's -- a
 * malformed order number fails the same way via Zod `VALIDATION` (`zPublicOrderNo`), so both map
 * to a real 404 rather than an error page.
 */
export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getSiteRequestContext();

  const result = await getMyOrderQuery({ orderNo: id }, ctx);

  if (!result.ok) {
    if (result.error.code === ErrorCode.NOT_FOUND || result.error.code === ErrorCode.VALIDATION) {
      notFound();
    }
    throw new Error(result.error.message);
  }

  const order = mapOrderDetailToOrderView(result.data);

  return (
    <OrderStatusScreen
      order={order}
      now={new Date().toISOString()}
      links={{
        purchases: "/account/purchases",
        entitlement: order.entitlementId ? `/account/purchases/${order.entitlementId}` : undefined,
        newQuery: "/account/queries",
        product: "/products",
      }}
    />
  );
}
