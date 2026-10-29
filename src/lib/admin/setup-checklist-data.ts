import { emailSenderProblem } from "@/lib/email/transport";
import { getEnv } from "@/lib/env";
import { getStoredEmailFrom } from "@/lib/site-brand";
import type { RequestContext } from "@/lib/authz/context";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import { getSettingsQuery } from "@/modules/settings/queries";
import { listAdminUsersQuery } from "@/modules/users/queries";
import { computeSetupChecklist, type SetupItem } from "./setup-checklist";

/** Super-admin dashboard checklist. A failed lookup counts as "not done" rather than hiding the item. */
export async function loadSetupChecklist(ctx: RequestContext): Promise<SetupItem[]> {
  const [settings, products, admins] = await Promise.all([
    getSettingsQuery({}, ctx).catch(() => null),
    listProductsAdminQuery({ limit: 100 }, ctx).catch(() => null),
    listAdminUsersQuery({ limit: 100 }, ctx).catch(() => null),
  ]);
  const s = settings?.ok ? settings.data.settings : null;
  return computeSetupChecklist({
    siteName: s?.siteName ?? "",
    siteLogo: s?.siteLogo ?? null,
    gstin: s?.gstin ?? null,
    sellerDetails: s?.sellerDetails ?? null,
    razorpayKeyId: s?.razorpaySettings?.keyId ?? null,
    upiVpa: s?.upiVpa ?? null,
    bankDetails: s?.bankDetails ?? null,
    emailProblem: emailSenderProblem(
      getEnv(),
      s?.emailFromAddress ? await getStoredEmailFrom() : null,
    ),
    publishedProducts: products?.ok
      ? products.data.items.filter((p) => p.status === "published").length
      : 0,
    superAdmins: admins?.ok ? admins.data.items.filter((u) => u.role === "super_admin").length : 0,
  });
}
