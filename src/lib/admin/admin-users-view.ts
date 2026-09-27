/**
 * View-model mapper: `modules/users` admin-user rows -> admin component prop shapes
 * (`components/admin/types`). Kept out of the page component per the phase convention.
 *
 * Known gaps vs. a fully-populated screen -- see the phase report:
 *  - A `suspended` admin-class user shows as `status: "active"`: the component prop type has no
 *    `suspended` state (admins aren't normally suspended, so this is expected to be rare).
 *  - `invited` rows have no real user id -- the underlying `admin.user_change` invite approval's
 *    subject is a fresh random id, not a user id, so `id` is the approval request id until the
 *    invite is approved and a real user row is created.
 */
import type { AdminUserRow as ModuleAdminUserRow } from "@/modules/users/types";
import type { AdminUserRow } from "@/components/admin/types";

export function mapAdminUserRow(row: ModuleAdminUserRow): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    ...(row.partner ? { partner: row.partner } : {}),
    totp: row.totp,
    ...(row.lastSignInAt ? { lastSignInAt: row.lastSignInAt } : {}),
    status: row.status,
    ...(row.pendingApprovalId ? { pendingApprovalId: row.pendingApprovalId } : {}),
  };
}
