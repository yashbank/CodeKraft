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
  revealLicenseKeySchema,
  revokeEntitlementSchema,
} from "./types";
import { AppError, ErrorCode } from "@/lib/errors";
import { checkClass } from "@/lib/rate-limit";
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

/**
 * API-DEL-03 `revealLicenseKey` (R8-03) — the customer's own key, rate class `key_reveal`
 * (10/hour per user), audited `license.revealed` inside the service.
 */
export const revealLicenseKeyAction = defineAction({
  name: "API-DEL-03 revealLicenseKey",
  input: revealLicenseKeySchema,
  permission: "delivery.self",
  handler: async (input, ctx) => {
    if (ctx.userId) {
      const limited = await checkClass("key_reveal", { user: ctx.userId });
      if (!limited.allowed) {
        throw new AppError(ErrorCode.RATE_LIMITED, undefined, {
          retryAfterMs: Math.max(0, limited.resetAt - Date.now()),
        });
      }
    }
    return entitlementsService.revealLicenseKey(ctx, input);
  },
});
