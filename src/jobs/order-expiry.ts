/**
 * Order expiry cron job (docs/06 §3.3 frequent endpoint, master plan §3).
 */
import { expirePendingOrders } from "@/modules/orders/expiry";

export const orderExpiryJob = {
  key: "orders.expire" as const,
  async run(now: Date = new Date()) {
    const result = await expirePendingOrders(now);
    return {
      expiredCount: result.expiredOrderIds.length,
      expiredOrderIds: result.expiredOrderIds,
    };
  },
};
