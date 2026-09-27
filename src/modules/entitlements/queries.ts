"use server";

/**
 * `entitlements` read-only queries — owned by P6 (master plan §3 ownership map). `entitlementsService`
 * is fully implemented (see `service.ts`, 1000+ lines); this file adds the `defineAction`
 * wrappers P2.8 left empty, following `finance/queries.ts` / `approvals/queries.ts`.
 */
import { defineAction } from "@/lib/actions/envelope";
import { getEntitlementAdminSchema, listEntitlementsAdminSchema } from "./types";
import { entitlementsService } from "./service";

export const listEntitlementsAdminQuery = defineAction({
  name: "API-DEL-06 listEntitlementsAdmin",
  input: listEntitlementsAdminSchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => entitlementsService.listEntitlementsAdmin(ctx, input),
});

export const getEntitlementAdminQuery = defineAction({
  name: "API-DEL-06 getEntitlementAdmin",
  input: getEntitlementAdminSchema,
  permission: "delivery.tasks.write",
  handler: (input, ctx) => entitlementsService.getEntitlementAdmin(ctx, input),
});
