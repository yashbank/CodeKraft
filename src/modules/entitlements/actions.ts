"use server";

/**
 * `entitlements` Server Actions — owned by P6 (master plan §3 ownership map). `entitlementsService`
 * is fully implemented (see `service.ts`); this file adds the `defineAction` wrappers P2.8 left
 * empty (SA-07: every export here must be created with `defineAction` / `definePublicAction`).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  extendAccessSchema,
  grantEntitlementSchema,
  resetDownloadCountSchema,
  revokeEntitlementSchema,
} from "./types";
import { entitlementsService } from "./service";

export const grantEntitlementManualAction = defineAction({
  name: "API-DEL-11 grantEntitlement",
  input: grantEntitlementSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.grantManual(ctx, input),
});

export const revokeEntitlementAction = defineAction({
  name: "API-DEL-12 revokeEntitlement",
  input: revokeEntitlementSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.revokeEntitlement(ctx, input),
});

export const resetDownloadCountAction = defineAction({
  name: "API-DEL-13 resetDownloadCount",
  input: resetDownloadCountSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.resetDownloadCount(ctx, input),
});

export const extendAccessAction = defineAction({
  name: "API-DEL-14 extendAccess",
  input: extendAccessSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.extendAccess(ctx, input),
});
