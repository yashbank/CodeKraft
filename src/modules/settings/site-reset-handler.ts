/** Registers the `site.reset` apply handler (imported by approvals/actions.ts like every other type). */
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import { revalidatePathSafe, revalidateTagsSafe } from "@/lib/revalidate";
import { resetDbFrom, runReset } from "./site-reset";

approvalsService.registerApplyHandler("site.reset", async (ctx, payload, tx) => {
  const counts = await runReset(resetDbFrom(tx), payload.categories);
  await auditService.log(
    { kind: "system", name: "system", requestId: ctx.requestId },
    "site.reset_executed",
    { type: "site", id: ctx.subject.id },
    null,
    { categories: payload.categories, approvedBy: ctx.decidedBy, counts },
    tx,
  );
  // The wipe changes brand/theme/catalog/content rows the site serves from tagged caches
  // (up to 5 min stale otherwise), and the admin shell reads settings per request.
  revalidateTagsSafe(["settings", "content", "catalog", "sitemap", "blog", "case-studies"]);
  revalidatePathSafe("/");
});
