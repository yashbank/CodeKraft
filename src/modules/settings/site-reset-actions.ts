"use server";

/** Server actions for the Settings "Danger zone": preview, backup, request (super admin only). */
import { randomUUID } from "node:crypto";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail, ok } from "@/lib/actions/envelope";

async function reader(raw: unknown) {
  const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
  const { assertSuperAdmin, resetDbFrom, siteResetInput } = await import("./site-reset");
  assertSuperAdmin(await getAdminRequestContext());
  const { db } = await import("@/lib/db");
  const { categories } = siteResetInput.pick({ categories: true }).parse(raw);
  return { categories, rdb: resetDbFrom(db as never) };
}

export async function previewSiteReset(
  raw: unknown,
): Promise<ActionResult<{ table: string; count: number }[]>> {
  try {
    const { categories, rdb } = await reader(raw);
    const { previewCounts } = await import("./site-reset");
    return ok(await previewCounts(rdb, categories));
  } catch (err) {
    return fail(err);
  }
}

export async function backupSiteReset(raw: unknown): Promise<ActionResult<string>> {
  try {
    const { categories, rdb } = await reader(raw);
    const { backupJson } = await import("./site-reset");
    return ok(await backupJson(rdb, categories));
  } catch (err) {
    return fail(err);
  }
}

export async function requestSiteResetAction(
  raw: unknown,
): Promise<ActionResult<{ approvalRequestId: string }>> {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const { requestSiteReset } = await import("./site-reset");
    const { getSiteName } = await import("@/lib/site-brand");
    const { withTx } = await import("@/lib/db");
    const { approvalsService } = await import("@/modules/approvals/service");
    const { auditService } = await import("@/modules/audit/service");
    const r = await requestSiteReset(ctx, raw, {
      siteName: getSiteName,
      create: (c, categories) =>
        withTx(async (tx) => {
          const id = randomUUID();
          const { approvalRequestId } = await approvalsService.request(
            "site.reset",
            { type: "site", id },
            { categories },
            c.userId,
            tx,
          );
          await auditService.log(
            c,
            "site.reset_requested",
            { type: "site", id },
            null,
            { categories, approvalRequestId },
            tx,
          );
          return approvalRequestId;
        }),
    });
    return ok({ approvalRequestId: r.approvalRequestId });
  } catch (err) {
    return fail(err);
  }
}
