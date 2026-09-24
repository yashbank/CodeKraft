/**
 * Data-scope resolvers for the ◐ cells of docs/06 §1.2 (D-512, FR-ADM-15, FR-FIN-12,
 * FR-LEAD-10; docs/09 §4.1). Queries receive the descriptor and apply it in SQL — never
 * filter in JavaScript after loading all rows (docs/09 §4.2).
 *
 * Precedence: `super_admin` → `all`; `staff` → `all` (● cells); `admin` → own partner /
 * assigned; anyone else → `FORBIDDEN`. An `admin` without a partner record cannot be scoped
 * and is refused (every scope resolver must exist before `admin` is granted — docs/09 §4.1).
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { type Context, type RequestContext, isAuthenticated } from "./context";

export type PartnerScope = "all" | { readonly partnerId: string };
export type LeadScope = "all" | { readonly assignedTo: string; readonly orUnassigned: true };

function unscoped(ctx: RequestContext): boolean {
  return ctx.roles.includes("super_admin") || ctx.roles.includes("staff");
}

function outOfScope(subject: string): AppError {
  return new AppError(ErrorCode.FORBIDDEN, undefined, { cause: { scope: subject } });
}

function partnerScope(ctx: Context, subject: string): PartnerScope {
  if (isAuthenticated(ctx)) {
    if (unscoped(ctx)) return "all";
    if (ctx.roles.includes("admin") && ctx.partnerId !== undefined) {
      return { partnerId: ctx.partnerId };
    }
  }
  throw outOfScope(subject);
}

/** Products (and their offerings/media/versions) where the caller's partner holds a share. */
export function productScope(ctx: Context): PartnerScope {
  return partnerScope(ctx, "product");
}

/** Orders / invoices containing the caller's own products. */
export function orderScope(ctx: Context): PartnerScope {
  return partnerScope(ctx, "order");
}

/** Own partner ledger lines + entries on own products; own statement (FR-FIN-12). */
export function ledgerScope(ctx: Context): PartnerScope {
  return partnerScope(ctx, "ledger");
}

/** Leads assigned to the caller or in the unassigned pool (FR-LEAD-10). */
export function leadScope(ctx: Context): LeadScope {
  if (isAuthenticated(ctx)) {
    if (unscoped(ctx)) return "all";
    if (ctx.roles.includes("admin")) return { assignedTo: ctx.userId, orUnassigned: true };
  }
  throw outOfScope("lead");
}

export function isUnscoped(scope: PartnerScope | LeadScope): scope is "all" {
  return scope === "all";
}
