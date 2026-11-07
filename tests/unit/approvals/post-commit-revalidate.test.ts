import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, revalidatePath }));
vi.mock("@/lib/authz/admin-request-context", () => ({
  getAdminRequestContext: async () => ({ userId: "u1" }),
}));
const approveRequestAction = vi.fn();
vi.mock("@/modules/approvals/actions", () => ({
  approveRequestAction,
  rejectRequestAction: vi.fn(),
  cancelRequestAction: vi.fn(),
  retryApplyAction: vi.fn(),
}));

describe("approvals admin mutations", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
    approveRequestAction.mockReset();
  });

  it("drops the settings and catalog caches after a successful approval commits", async () => {
    approveRequestAction.mockResolvedValue({ ok: true, data: {} });
    const { approveRequest } = await import("@/modules/approvals/admin-mutations");
    await approveRequest({ id: "a" });
    const tags = revalidateTag.mock.calls.map((c) => c[0]);
    expect(tags).toEqual(expect.arrayContaining(["settings", "content", "catalog"]));
  });

  it("does not revalidate when the approval fails", async () => {
    approveRequestAction.mockResolvedValue({ ok: false, error: { code: "X", message: "no" } });
    const { approveRequest } = await import("@/modules/approvals/admin-mutations");
    await approveRequest({ id: "a" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
