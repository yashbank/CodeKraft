import { describe, expect, it } from "vitest";
import { computeApproverSet, countActiveAdmins } from "@/modules/approvals/approver-set";
import type { DbOrTx } from "@/lib/db";

describe("approver-set calculation unit tests (MASTER_SPEC §7, PHASE-03 P3.2)", () => {
  it("excludes requester and counts active admin-class users (two admins -> one approver)", async () => {
    const admin1 = "admin-1";
    const admin2 = "admin-2";

    const mockDb: DbOrTx = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{ userId: admin2 }]),
          }),
        }),
      }),
    } as unknown as DbOrTx;

    const approvers = await computeApproverSet(admin1, mockDb);
    expect(approvers).toEqual([admin2]);
  });

  it("calculates approver set for three admins (three admins -> two approvers)", async () => {
    const requester = "admin-requester";
    const adminA = "admin-a";
    const adminB = "admin-b";

    const mockDb: DbOrTx = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{ userId: adminA }, { userId: adminB }]),
          }),
        }),
      }),
    } as unknown as DbOrTx;

    const approvers = await computeApproverSet(requester, mockDb);
    expect(approvers).toHaveLength(2);
    expect(approvers).toContain(adminA);
    expect(approvers).toContain(adminB);
  });

  it("counts distinct active admins in the system", async () => {
    const mockDb: DbOrTx = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () =>
              Promise.resolve([
                { userId: "usr-1" },
                { userId: "usr-2" },
                { userId: "usr-1" }, // duplicate role entry
              ]),
          }),
        }),
      }),
    } as unknown as DbOrTx;

    const count = await countActiveAdmins(mockDb);
    expect(count).toBe(2);
  });
});
