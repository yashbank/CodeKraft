import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/admin-users",
}));

const listAuditLogsMock = vi.fn();

vi.mock("@/modules/audit/admin-mutations", () => ({
  exportAuditLogs: vi.fn(async () => ({ ok: false, error: { message: "not used" } })),
  listAuditLogs: (...args: unknown[]) => listAuditLogsMock(...args),
}));

import { AuditLog } from "@/components/admin/system/AuditLog";
import { AdminUsers } from "@/components/admin/system/AdminUsers";
import { AUDIT_ROWS, ADMINS, ADMIN_USERS } from "@/app/dev/screens/_fixtures/admin";

afterEach(() => {
  cleanup();
  listAuditLogsMock.mockReset();
});

describe("AuditLog filters (BUG-008/009/017)", () => {
  it("sends the search text and subject-id filter to listAuditLogs instead of filtering nothing", async () => {
    listAuditLogsMock.mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null, total: 0 },
    });

    render(
      <AuditLog
        rows={AUDIT_ROWS}
        nextCursor={null}
        total={AUDIT_ROWS.length}
        admins={ADMINS}
        approvalsHref="/admin/approvals"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Action or memo…"), {
      target: { value: "razorpay" },
    });

    await waitFor(
      () => {
        expect(listAuditLogsMock).toHaveBeenCalledWith(expect.objectContaining({ q: "razorpay" }));
      },
      { timeout: 1000 },
    );
  });

  it("requests the next cursor page when Load more is clicked (no more 100-row hard cap)", async () => {
    listAuditLogsMock.mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null, total: 200 },
    });

    render(
      <AuditLog
        rows={AUDIT_ROWS}
        nextCursor="cursor-abc"
        total={200}
        admins={ADMINS}
        approvalsHref="/admin/approvals"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(listAuditLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "cursor-abc" }),
      );
    });
  });

  it("does not default the date range to an empty-looking window (BUG-009)", () => {
    render(
      <AuditLog
        rows={AUDIT_ROWS}
        nextCursor={null}
        total={AUDIT_ROWS.length}
        admins={ADMINS}
        approvalsHref="/admin/approvals"
      />,
    );
    const from = screen.getByLabelText("From") as HTMLInputElement;
    const to = screen.getByLabelText("To") as HTMLInputElement;
    expect(from.value).toBe("");
    expect(to.value).toBe("");
  });
});

describe("AdminUsers search and role filter (BUG-019)", () => {
  it("narrows the table by name/email search", () => {
    render(
      <AdminUsers
        users={ADMIN_USERS}
        currentUserId={ADMIN_USERS[0]!.id}
        approvers={[]}
        approvalsHref="/admin/approvals"
        productHref="/admin/products"
        auditHref="/admin/audit"
      />,
    );
    expect(screen.getByText("Sam Rao")).toBeInTheDocument();
    expect(screen.getByText("priya@codekraft.in")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Name or email…"), {
      target: { value: "sam" },
    });

    expect(screen.getByText("Sam Rao")).toBeInTheDocument();
    expect(screen.queryByText("priya@codekraft.in")).not.toBeInTheDocument();
  });

  it("shows the role filter control with every admin role", () => {
    render(
      <AdminUsers
        users={ADMIN_USERS}
        currentUserId={ADMIN_USERS[0]!.id}
        approvers={[]}
        approvalsHref="/admin/approvals"
        productHref="/admin/products"
        auditHref="/admin/audit"
      />,
    );
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
  });
});
