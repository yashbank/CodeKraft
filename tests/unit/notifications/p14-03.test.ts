import { describe, expect, it, vi } from "vitest";
import { readThenOpen } from "@/lib/notifications/read-state";
import { renderNotification } from "@/modules/notifications/templates";

const click = (over: Partial<Parameters<typeof readThenOpen>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  preventDefault: vi.fn(),
  ...over,
});

describe("P14-03 link targets open the item, not just the section", () => {
  it.each([
    ["query.new", { queryId: "Q1" }, "/admin/queries/Q1"],
    ["query.new", { queryId: "Q1", audience: "customer" }, "/account/queries/Q1"],
    ["query.replied", { queryId: "Q1" }, "/account/queries/Q1"],
    ["query.customer_replied", { queryId: "Q1" }, "/admin/queries/Q1"],
    ["approval.requested", { approvalId: "A1" }, "/admin/approvals?id=A1"],
    ["approval.approved", { approvalId: "A1" }, "/admin/approvals?id=A1"],
    ["approval.rejected", { approvalId: "A1" }, "/admin/approvals?id=A1"],
    ["chat.cap_reached", {}, "/admin/chatbot"],
  ] as const)("%s %j -> %s", (type, payload, link) => {
    expect(renderNotification(type, payload).link).toBe(link);
  });
});

describe("P14-03 readThenOpen", () => {
  it("persists read before opening (no navigate/write race)", async () => {
    const order: string[] = [];
    const e = click();
    await readThenOpen(
      e,
      async () => {
        await Promise.resolve();
        order.push("read");
      },
      () => order.push("open"),
    );
    expect(e.preventDefault).toHaveBeenCalled();
    expect(order).toEqual(["read", "open"]);
  });

  it("still opens when the write fails", async () => {
    const open = vi.fn();
    await readThenOpen(click(), () => Promise.reject(new Error("x")), open);
    expect(open).toHaveBeenCalled();
  });

  it("modified click keeps the browser default and only fires the write", async () => {
    const mark = vi.fn(() => Promise.resolve());
    const open = vi.fn();
    const e = click({ metaKey: true });
    await readThenOpen(e, mark, open);
    expect(mark).toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
