"use server";

/**
 * `entitlements` read-only queries — owned by P6 (master plan §3 ownership map). `entitlementsService`
 * is fully implemented (see `service.ts`, 1000+ lines); this file adds the `defineAction`
 * wrappers P2.8 left empty, following `finance/queries.ts` / `approvals/queries.ts`.
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  getEntitlementAdminSchema,
  getMyEntitlementSchema,
  listEntitlementsAdminSchema,
  listMyEntitlementsSchema,
} from "./types";
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

export const listMyEntitlementsQuery = defineAction({
  name: "API-DEL-01 listMyEntitlements",
  input: listMyEntitlementsSchema,
  permission: "delivery.self",
  handler: (input, ctx) => entitlementsService.listMyEntitlements(ctx, input),
});

/**
 * API-DEL-01 `getMyEntitlement` — the single-entitlement counterpart of `listMyEntitlements`, for
 * the entitlement detail screen (SCR-ACC-03). `entitlementsService.getMyEntitlement` was already
 * fully implemented (scoped to `ctx.userId`, `NOT_FOUND` when not owned by the caller) but never
 * had a `defineAction` wrapper.
 */
export const getMyEntitlementQuery = defineAction({
  name: "API-DEL-01 getMyEntitlement",
  input: getMyEntitlementSchema,
  permission: "delivery.self",
  handler: (input, ctx) => entitlementsService.getMyEntitlement(ctx, input),
});
