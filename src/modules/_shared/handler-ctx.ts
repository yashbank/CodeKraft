import { AppError, ErrorCode } from "@/lib/errors";
import type { DeliveryHandlerContext } from "@/modules/delivery/handler";
import type { Subscription } from "../../../drizzle/schema/delivery";
import type { offerings } from "../../../drizzle/schema/offerings";
import type { products } from "../../../drizzle/schema/catalog";
import type { users } from "../../../drizzle/schema/auth";

/** Row that must exist (FK-guaranteed or just written); fail loudly rather than dereference undefined. */
export function required<T>(row: T | null | undefined, what: string): T {
  if (row === undefined || row === null) throw new AppError(ErrorCode.INTERNAL, `${what} missing`);
  return row;
}

export function buildHandlerCtx(
  requestId: string,
  actorId: string | null,
  offering: typeof offerings.$inferSelect,
  product: typeof products.$inferSelect,
  customer: typeof users.$inferSelect,
  subscription: Subscription | null,
  manualGrant: boolean,
): DeliveryHandlerContext {
  return {
    actorId,
    requestId,
    offering: {
      id: offering.id,
      name: offering.name,
      deliveryConfig: offering.deliveryConfig,
      serviceSteps: offering.serviceSteps,
      purchaseModel: offering.purchaseModel,
    },
    product: { id: product.id, name: product.name, slug: product.slug },
    customer: { id: customer.id, email: customer.email, name: customer.name },
    subscription,
    manualGrant,
  };
}
