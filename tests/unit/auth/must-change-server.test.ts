// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const session = { current: null as unknown };
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/modules/auth/service", () => ({ getSession: async () => session.current }));
vi.mock("@/modules/auth/roles-port", () => ({ loadRoles: async () => ["admin"] }));
const completeForcedChange = vi.fn().mockResolvedValue(undefined);
vi.mock("@/modules/auth/invites", () => ({
  completeForcedChange: (...a: unknown[]) => completeForcedChange(...a),
}));
// R9-10: the admin context now looks up the caller's partner row.
vi.mock("@/lib/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { ERROR_HTTP_STATUS, ErrorCode } from "@/lib/errors";
import { changeTemporaryPassword } from "@/modules/auth/invite-actions";

const sess = (must: boolean) => ({
  user: { id: "00000000-0000-4000-8000-000000000001", mustChangePassword: must },
  session: { id: "s", token: "t" },
});

describe("must_change_password enforced server-side", () => {
  it("rejects request contexts for a must-change session (maps to 403)", async () => {
    session.current = sess(true);
    await expect(getAdminRequestContext()).rejects.toMatchObject({
      code: ErrorCode.PASSWORD_CHANGE_REQUIRED,
    });
    await expect(getSiteRequestContext()).rejects.toMatchObject({
      code: ErrorCode.PASSWORD_CHANGE_REQUIRED,
    });
    expect(ERROR_HTTP_STATUS[ErrorCode.PASSWORD_CHANGE_REQUIRED]).toBe(403);
  });

  it("allows normal sessions and the change-password action", async () => {
    session.current = sess(false);
    await expect(getAdminRequestContext()).resolves.toBeDefined();
    session.current = sess(true);
    const res = await changeTemporaryPassword({
      currentPassword: "old",
      newPassword: "new-pass-123456",
    });
    expect(res.ok).toBe(true);
    expect(completeForcedChange).toHaveBeenCalled();
  });
});
