"use server";

/** Thin server-action wrapper so the admin ChatbotMonitor can call the search reindex by name. */
import { revalidatePath } from "next/cache";
import { fail } from "@/lib/actions/envelope";

export async function reindexContent(raw: unknown) {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const { reindexKnowledgeAction } = await import("./actions");
    const result = await reindexKnowledgeAction(raw, ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    return fail(err);
  }
}
