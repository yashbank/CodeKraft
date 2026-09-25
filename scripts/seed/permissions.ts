/**
 * Step 1 — `permissions` and `role_permissions` from src/lib/authz/permissions.ts (docs/06 §1.2,
 * TM-14). Roles themselves come from migration 0000. The code is the source of truth: keys are
 * upserted, and role/permission pairs that the matrix no longer lists are removed so the tables
 * never drift from `ROLE_PERMISSIONS`.
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";

import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/lib/authz/permissions";
import { roles } from "../../drizzle/schema/auth";
import { permissions, rolePermissions } from "../../drizzle/schema/users-ext";
import { type SeedContext, tally } from "./shared";

/** Human descriptions for the summary/admin UI; the key itself is the contract. */
function describe(key: string): string {
  const [area, ...rest] = key.split(".");
  return `${area ?? key}: ${rest.join(" ")}`.trim();
}

export async function seedPermissions(ctx: SeedContext): Promise<void> {
  const { db } = ctx;

  const roleRows = await db.select({ key: roles.key }).from(roles);
  const present = new Set(roleRows.map((r) => r.key));
  const missing = ROLES.filter((r) => !present.has(r));
  if (missing.length > 0)
    throw new Error(`roles missing from migration 0000: ${missing.join(", ")} — run db:migrate`);

  const before = new Set(
    (await db.select({ key: permissions.key }).from(permissions)).map((r) => r.key),
  );
  let createdPermissions = 0;
  let updatedPermissions = 0;
  for (const key of PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ key, description: describe(key) })
      .onConflictDoUpdate({ target: permissions.key, set: { description: describe(key) } });
    if (before.has(key)) updatedPermissions += 1;
    else createdPermissions += 1;
  }
  // Keys that left the code are removed (cascades to role_permissions).
  await db.delete(permissions).where(notInArray(permissions.key, [...PERMISSIONS]));
  tally(ctx, "permissions", createdPermissions, updatedPermissions);

  let createdPairs = 0;
  for (const role of ROLES) {
    const wanted = ROLE_PERMISSIONS[role];
    const existing = new Set(
      (
        await db
          .select({ permissionKey: rolePermissions.permissionKey })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleKey, role))
      ).map((r) => r.permissionKey),
    );
    const toInsert = wanted.filter((p) => !existing.has(p));
    if (toInsert.length > 0) {
      await db
        .insert(rolePermissions)
        .values(toInsert.map((permissionKey) => ({ roleKey: role, permissionKey })))
        .onConflictDoNothing();
      createdPairs += toInsert.length;
    }
    const stale = [...existing].filter((p) => !(wanted as readonly string[]).includes(p));
    if (stale.length > 0) {
      await db
        .delete(rolePermissions)
        .where(
          and(eq(rolePermissions.roleKey, role), inArray(rolePermissions.permissionKey, stale)),
        );
    }
  }
  tally(ctx, "role_permissions", createdPairs);
  ctx.log(`permissions: ${PERMISSIONS.length} keys, ${ROLES.length} roles in sync`);
}
