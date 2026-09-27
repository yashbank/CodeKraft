"use server";

/**
 * `coupons` read-only queries (API-COM-08 `listCoupons`, PHASE-05).
 * Queries are `defineAction` reads that never mutate; the underlying service method already
 * asserts `orders.manual.write` (coupons management is gated the same as manual orders).
 *
 * `couponsService` is imported lazily inside the handler (never a static top-level import):
 * `coupons/service.ts` pulls in `@/lib/db` at module scope, which throws in a jsdom test
 * environment (`src/lib/env.ts` guards against `window`) -- a static import here would drag
 * that into any client component that imports this file's sibling `admin-mutations.ts`.
 */
import { defineAction } from "@/lib/actions/envelope";
import { listCouponsInput } from "./types";

export const listCouponsQuery = defineAction({
  name: "API-COM-08 listCoupons",
  input: listCouponsInput,
  permission: "orders.manual.write",
  handler: async (input, ctx) => {
    const { couponsService } = await import("./service");
    return couponsService.listCoupons(ctx, input);
  },
});
