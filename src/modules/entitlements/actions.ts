/**
 * `entitlements` Server Actions — docs/06 §2.5 API-DEL-02/03 (customer, `delivery.self`) and
 * API-DEL-11/12/13/14 (`entitlements.admin`). Every export is a `defineAction` (SA-07): Zod parse →
 * permission → service, which audits inside its transaction. Entitlements are private data, so
 * no public cache tag is revalidated (docs/06 §1.10).
 */
import { defineAction } from "@/lib/actions";
import { entitlementsService } from "./service";
import {
  extendAccessSchema,
  grantEntitlementSchema,
  issueDownloadLinkSchema,
  resetDownloadCountSchema,
  revealLicenseKeySchema,
  revokeEntitlementSchema,
} from "./types";

/** API-DEL-02 `issueDownloadLink` — rate class `download`; atomic cap check (BR-15). */
export const issueDownloadLink = defineAction({
  name: "API-DEL-02 download.issue",
  input: issueDownloadLinkSchema,
  permission: "delivery.self",
  handler: (input, ctx) => entitlementsService.issueDownloadLink(ctx, input),
});

/** API-DEL-03 `revealLicenseKey` — rate class `key_reveal`; audited `license.revealed`. */
export const revealLicenseKey = defineAction({
  name: "API-DEL-03 license.reveal",
  input: revealLicenseKeySchema,
  permission: "delivery.self",
  handler: (input, ctx) => entitlementsService.revealLicenseKey(ctx, input),
});

/** API-DEL-11 `grantEntitlement` — manual grant, mandatory reason, no ledger (D-1108). */
export const grantEntitlement = defineAction({
  name: "API-DEL-11 entitlement.grant_manual",
  input: grantEntitlementSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.grantManual(ctx, input),
});

/** API-DEL-12 `revokeEntitlement`. */
export const revokeEntitlement = defineAction({
  name: "API-DEL-12 entitlement.revoke",
  input: revokeEntitlementSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.revokeEntitlement(ctx, input),
});

/** API-DEL-13 `resetDownloadCount` (D-606). */
export const resetDownloadCount = defineAction({
  name: "API-DEL-13 entitlement.reset_download_count",
  input: resetDownloadCountSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.resetDownloadCount(ctx, input),
});

/** API-DEL-14 `extendAccess`. */
export const extendAccess = defineAction({
  name: "API-DEL-14 entitlement.extend_access",
  input: extendAccessSchema,
  permission: "entitlements.admin",
  handler: (input, ctx) => entitlementsService.extendAccess(ctx, input),
});
