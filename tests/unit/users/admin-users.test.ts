// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/lib/errors";
import { buildContext } from "@/lib/authz/context";
import { changeAdminRole, inviteAdmin, removeAdmin } from "@/modules/users/admin-users";
import type { DbOrTx } from "@/lib/db";

function mockAdminCtx(_permissions: string[] = ["users.admin.manage"]) {
  return buildContext({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    session: { id: "00000000-0000-0000-0000-000000000002" },
    roles: ["super_admin"],
  });
}

function mockStaffCtx() {
  return buildContext({
    user: { id: "00000000-0000-0000-0000-000000000003" },
    session: { id: "00000000-0000-0000-0000-000000000004" },
    roles: ["staff"],
  });
}

describe("admin users refusal matrix (API-ADM-11, MASTER_SPEC §7)", () => {
  it("rejects caller lacking users.admin.manage permission with FORBIDDEN", async () => {
    const staffCtx = mockStaffCtx();
    const fakeDb = {} as DbOrTx;

    await expect(
      removeAdmin(staffCtx, { userId: "00000000-0000-0000-0000-000000000099" }, fakeDb),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });

    await expect(
      changeAdminRole(
        staffCtx,
        { userId: "00000000-0000-0000-0000-000000000099", role: "staff" },
        fakeDb,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });

    await expect(
      inviteAdmin(staffCtx, { email: "newadmin@example.com", role: "admin" }, fakeDb),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it("removeAdmin throws NOT_FOUND when target user does not exist", async () => {
    const adminCtx = mockAdminCtx();
    const fakeDb = {
      $client: {},
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as DbOrTx;

    await expect(
      removeAdmin(adminCtx, { userId: "00000000-0000-0000-0000-000000000099" }, fakeDb),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      message: /not found/i,
    });
  });

  it("changeAdminRole throws NOT_FOUND when target user does not exist", async () => {
    const adminCtx = mockAdminCtx();
    const fakeDb = {
      $client: {},
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as DbOrTx;

    await expect(
      changeAdminRole(
        adminCtx,
        { userId: "00000000-0000-0000-0000-000000000099", role: "staff" },
        fakeDb,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      message: /not found/i,
    });
  });
});
