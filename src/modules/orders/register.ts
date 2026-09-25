/** Registers the orders module's approval handlers with the approvals registry (bootstrap). */
import type { ApplyHandlerRegistry } from "@/modules/approvals/contracts";
import { rejectProjectOrderSplit } from "./project-split";
import { type OrdersModule, ordersService } from "./service";

export function registerOrdersApprovalHandlers(
  registry: ApplyHandlerRegistry,
  svc: OrdersModule = ordersService,
): void {
  registry.registerApplyHandler("project_order.split", (ctx, payload, tx) =>
    svc.applyProjectOrderSplit(payload, ctx.requestId, tx),
  );
  registry.registerRejectHandler("project_order.split", (_ctx, payload, tx) =>
    rejectProjectOrderSplit(svc, payload, tx),
  );
}
