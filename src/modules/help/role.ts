/** Who may use the help assistant (P22-1): staff, partners and admins only. Customers and anonymous: never. */
import { eq } from "drizzle-orm";
import type { HelpRole } from "@/modules/help/knowledge";

/** Pure mapping from role keys to a help role; "customer" means no help. */
export function helpRoleFromRoles(
  roles: readonly string[],
  partnerId: string | undefined,
): HelpRole {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  return partnerId ? "partner" : "customer";
}

/** True for roles that get the assistant. */
export function helpAllowed(role: HelpRole): boolean {
  return role !== "customer";
}

/** Looks up the user's partner row (partners are admin-area users with a `partners` row). */
export async function findPartnerId(userId: string): Promise<string | undefined> {
  const [{ db }, { partners }] = await Promise.all([
    import("@/lib/db"),
    import("../../../drizzle/schema/users-ext"),
  ]);
  const [row] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, userId))
    .limit(1);
  return row?.id;
}
