import { describe, expect, it } from "vitest";
import { entitlementStatusLine } from "@/components/account/EntitlementCard";
import { adminStatusInput, mapEntitlementRow } from "@/lib/admin/entitlements-view";
import { mapEntitlementSummary } from "@/lib/account/purchases-view";
import { entitlementStatus } from "@/lib/entitlement-status";
import type { EntitlementAdminRow, EntitlementView } from "@/modules/entitlements/types";

const START = "2026-03-01T06:00:00Z";
const END = "2027-03-01T06:00:00Z";
const TYPES = ["download", "license", "hosted", "saas", "service", "custom"] as const;
type T = (typeof TYPES)[number];

// [status, provisioningState, endsAt, expected label]
const CASES: Array<[EntitlementView["status"], "n/a" | "pending" | "done", string | null, string]> =
  [
    ["pending", "pending", END, "Provisioning — we are setting this up"],
    ["active", "pending", END, "Provisioning — we are setting this up"],
    ["active", "done", END, "Active — service started 1 Mar 2026, expires 1 Mar 2027"],
    ["active", "n/a", END, "Active — service started 1 Mar 2026, expires 1 Mar 2027"],
    ["active", "done", null, "Active — service started 1 Mar 2026, no expiry"],
    ["suspended", "done", END, "Suspended — payment overdue"],
    ["expired", "done", END, "Expired on 1 Mar 2027"],
    ["revoked", "done", END, "Access revoked"],
  ];

function customer(t: T, s: EntitlementView["status"], p: string, end: string | null) {
  return {
    entitlementId: "e1",
    product: { id: "p", name: "P", slug: "p", published: true },
    offering: { id: "o", name: "O" },
    deliveryType: t,
    status: s,
    access: { startsAt: START, endsAt: end },
    updatePolicy: "all_free",
    orderNo: "CK-1",
    invoiceNo: null,
    grantedAt: START,
    instructionsHtml: null,
    versions: [],
    provisioning: p === "n/a" ? undefined : { state: p, notes: null },
  } as unknown as EntitlementView;
}

function admin(t: T, s: EntitlementView["status"], p: string, end: string | null) {
  return {
    entitlementId: "e1",
    user: { id: "u", email: "a@b.c", name: null },
    product: { id: "p", name: "P" },
    offering: { id: "o", name: "O" },
    deliveryType: t,
    status: s,
    provisioningState: p,
    accessStartsAt: START,
    accessEndsAt: end,
    downloads: null,
    licenseKeyIssued: false,
    orderNo: "CK-1",
    grantedManuallyBy: null,
    openTasks: 0,
    adminActions: [],
    createdAt: START,
  } as unknown as EntitlementAdminRow;
}

describe("entitlementStatus: delivery type x lifecycle state", () => {
  for (const t of TYPES) {
    for (const [s, p, end, label] of CASES) {
      it(`${t} ${s}/${p}/${end ? "dated" : "lifetime"} -> ${label}`, () => {
        // admin and customer mappers, same facts, must give the same line
        const c = entitlementStatusLine(mapEntitlementSummary(customer(t, s, p, end)));
        const a = entitlementStatus(adminStatusInput(mapEntitlementRow(admin(t, s, p, end)))).label;
        expect(c).toBe(label);
        expect(a).toBe(label);
      });
    }
  }

  it("subscription period end wins over entitlement end", () => {
    const r = entitlementStatus({
      status: "active",
      provisioningState: "done",
      startsAt: START,
      endsAt: END,
      subscriptionPeriodEnd: "2026-04-01T06:00:00Z",
    });
    expect(r.label).toBe("Active — service started 1 Mar 2026, expires 1 Apr 2026");
  });

  it("refunded order shows Refunded unless already revoked", () => {
    const base = { status: "active", provisioningState: "done", refunded: true } as const;
    expect(entitlementStatus(base).chip).toBe("Refunded");
    expect(entitlementStatus({ ...base, status: "revoked" }).chip).toBe("Revoked");
  });
});
