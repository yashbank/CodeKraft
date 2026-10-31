"use server";

/**
 * Admin-UI-facing wrapper so the Settings "Refresh now" button can call `refreshFxRatesAction`
 * without building a RequestContext. `settings.write` is still enforced inside the action.
 */
import { revalidatePath } from "next/cache";
import { fail } from "@/lib/actions/envelope";

export async function refreshFxRates() {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const { refreshFxRatesAction } = await import("./actions");
    const ctx = await getAdminRequestContext();
    const result = await refreshFxRatesAction({}, ctx);
    if (result.ok) {
      const { resetRateTableCache } = await import("./convert");
      resetRateTableCache();
      revalidatePath("/", "layout");
    }
    return result;
  } catch (err) {
    return fail(err);
  }
}
