import { describe, expect, it } from "vitest";
import { APPROVAL_TYPES } from "@/modules/approvals/types";
import { approvalDetailRows, approvalReason, describeApproval } from "@/lib/admin/approval-text";

const id = "3f2b8c1e-9a4d-4e6b-8c2f-1a2b3c4d5e6f";
const payloads: Record<(typeof APPROVAL_TYPES)[number], Record<string, unknown>> = {
  "product.publish": { productId: id },
  "ownership.change": { ownershipId: id, productId: id },
  "ledger.adjustment": { lines: [{ partnerId: id }, { partnerId: id }], reason: "Fix split" },
  "refund.issue": { refundId: id },
  "payout.record": { partnerId: id, amountMinor: 250000, currency: "INR", reference: "UTR1" },
  "product.archive": { productId: id, reason: "Retired" },
  "product.delete": { productId: id, reason: "Duplicate" },
  "admin.user_change": { kind: "change_role", userId: id, role: "super_admin" },
  "project_order.split": { orderId: id },
};
const facts = { productName: "Widget", orderNo: "CK-ORD-000012", partnerName: "Asha" };

describe("approval text", () => {
  it.each(APPROVAL_TYPES)("%s is plain language with no UUID or code", (type) => {
    const p = payloads[type];
    const text = [
      describeApproval(type, p, facts),
      describeApproval(type, p),
      approvalReason(p) ?? "",
      ...approvalDetailRows(p).flatMap((r) => [r.label, r.after]),
    ].join(" | ");
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(text).not.toContain(type);
    expect(text).not.toMatch(/[{}[\]_]/);
  });

  it("describes a refund with amount and order number", () => {
    expect(
      describeApproval("refund.issue", payloads["refund.issue"], {
        refundMinor: 400000,
        currency: "INR",
        orderNo: "CK-ORD-000012",
      }),
    ).toMatch(/^Refund .*4,000.* on order CK-ORD-000012$/);
  });
});
