// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ADMIN_CLASS_ROLES } from "@/lib/authz/permissions";
import { ADMIN_APP_ROLES, hasAdminClassRole } from "@/modules/auth/roles-port";

describe("R8-09 admin app access", () => {
  it("staff may sign in to the admin app (was rejected by the admin-host gate)", () => {
    expect(hasAdminClassRole(["staff"])).toBe(true);
    expect(hasAdminClassRole(["admin"])).toBe(true);
    expect(hasAdminClassRole(["super_admin"])).toBe(true);
    expect(hasAdminClassRole(["customer"])).toBe(false);
    expect(hasAdminClassRole([])).toBe(false);
  });

  it("does not widen the admin-class role set used for scopes/approvals", () => {
    expect([...ADMIN_CLASS_ROLES]).toEqual(["super_admin", "admin"]);
    expect([...ADMIN_APP_ROLES]).toEqual(["super_admin", "admin", "staff"]);
  });
});
