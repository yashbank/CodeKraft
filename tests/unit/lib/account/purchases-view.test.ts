import { describe, expect, it } from "vitest";
import {
  mapEntitlementDetail,
  mapEntitlementSummary,
  mapOrderSummaryView,
} from "@/lib/account/purchases-view";
import type { EntitlementView } from "@/modules/entitlements/types";
import type { OrderSummary } from "@/modules/orders/types";

/** A minimal, valid `EntitlementView` -- individual tests override just what they need. */
function baseEntitlement(overrides: Partial<EntitlementView> = {}): EntitlementView {
  return {
    entitlementId: "ent-1",
    product: { id: "prod-1", name: "Storefront Kit", slug: "storefront-kit", published: true },
    offering: { id: "off-1", name: "Lifetime license" },
    deliveryType: "download",
    status: "active",
    access: { startsAt: "2026-01-01T00:00:00Z", endsAt: null },
    updatePolicy: "all_free",
    orderNo: "CK-ORD-000001",
    invoiceNo: "CK/2026-27/0001",
    grantedAt: "2026-01-01T00:00:00Z",
    instructionsHtml: null,
    versions: [],
    ...overrides,
  };
}

describe("mapEntitlementDetail (SCR-ACC-03)", () => {
  it("builds on mapEntitlementSummary rather than recomputing its fields", () => {
    const e = baseEntitlement({
      downloads: { used: 1, cap: 5, files: [] },
    });
    const detail = mapEntitlementDetail(e);
    const summary = mapEntitlementSummary(e);
    // Every EntitlementSummary field must survive into EntitlementDetail unchanged.
    const detailRecord = detail as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(summary)) {
      expect(detailRecord[key]).toEqual(value);
    }
  });

  it("maps download files with a human-readable size label", () => {
    const e = baseEntitlement({
      downloads: {
        used: 2,
        cap: 5,
        files: [
          {
            mediaId: "media-1",
            version: "1.2.0",
            name: "storefront-kit-1.2.0.zip",
            sizeBytes: 2_621_440, // 2.5 MB
            releasedAt: "2026-02-01T00:00:00Z",
            notes: null,
          },
        ],
      },
    });
    const detail = mapEntitlementDetail(e);
    expect(detail.files).toEqual([
      {
        id: "media-1",
        name: "storefront-kit-1.2.0.zip",
        version: "1.2.0",
        sizeLabel: "2.5 MB",
        releasedAt: "2026-02-01T00:00:00Z",
      },
    ]);
  });

  it("formats sub-KB and sub-1024-of-next-unit sizes without a decimal blowing up", () => {
    const e = baseEntitlement({
      downloads: {
        used: 0,
        cap: null,
        files: [
          {
            mediaId: "m1",
            version: "1.0.0",
            name: "tiny.txt",
            sizeBytes: 512,
            releasedAt: "2026-01-01T00:00:00Z",
            notes: null,
          },
        ],
      },
    });
    expect(mapEntitlementDetail(e).files?.[0]?.sizeLabel).toBe("512 B");
  });

  it("never exposes a real license key -- full always mirrors masked", () => {
    const e = baseEntitlement({ deliveryType: "license", licenseKeyMasked: "•••• •••• •••• 4F2A" });
    const detail = mapEntitlementDetail(e);
    expect(detail.licenseKey).toEqual({
      masked: "•••• •••• •••• 4F2A",
      full: "•••• •••• •••• 4F2A",
    });
    // Explicitly: the mapper must never fabricate or forward a different "full" value.
    expect(detail.licenseKey?.full).toBe(detail.licenseKey?.masked);
  });

  it("omits licenseKey entirely when no key has been issued", () => {
    const e = baseEntitlement({ deliveryType: "license", licenseKeyMasked: null });
    expect(mapEntitlementDetail(e).licenseKey).toBeUndefined();
  });

  it("never fills in `hosted`, even for saas/hosted deliveries with structured provisioning notes", () => {
    const e = baseEntitlement({
      deliveryType: "saas",
      provisioning: {
        state: "done",
        notes: { loginUrl: "https://app.example.com", username: "buyer@example.com" },
      },
    });
    expect(mapEntitlementDetail(e).hosted).toBeUndefined();
  });

  it("only sets `steps` for service deliveries, mapping doneAt to state", () => {
    const serviceEntitlement = baseEntitlement({
      deliveryType: "service",
      serviceProgress: [
        {
          key: "kickoff",
          title: "Kickoff call",
          description: "Intro call",
          doneAt: "2026-01-05T00:00:00Z",
        },
        { key: "build", title: "Build", description: null, doneAt: null },
      ],
    });
    expect(mapEntitlementDetail(serviceEntitlement).steps).toEqual([
      {
        id: "kickoff",
        title: "Kickoff call",
        description: "Intro call",
        state: "done",
        doneAt: "2026-01-05T00:00:00Z",
      },
      { id: "build", title: "Build", description: undefined, state: "open", doneAt: undefined },
    ]);

    const downloadEntitlement = baseEntitlement({
      deliveryType: "download",
      serviceProgress: [{ key: "x", title: "x", description: null, doneAt: null }],
    });
    expect(mapEntitlementDetail(downloadEntitlement).steps).toBeUndefined();
  });

  it("maps custom attachments with size labels", () => {
    const e = baseEntitlement({
      deliveryType: "custom",
      custom: {
        attachments: [{ mediaId: "m1", name: "spec.pdf", sizeBytes: 150_000 }],
        statusNote: null,
      },
    });
    expect(mapEntitlementDetail(e).attachments).toEqual([
      { name: "spec.pdf", sizeLabel: "146 KB" },
    ]);
  });

  it("falls back to an empty changelog/instructions rather than fabricating content", () => {
    const e = baseEntitlement({ versions: [], instructionsHtml: null });
    const detail = mapEntitlementDetail(e);
    expect(detail.changelog).toEqual([]);
    expect(detail.instructions).toEqual([]);
  });

  it("maps versioned changelog entries, splitting multi-line notes", () => {
    const e = baseEntitlement({
      versions: [
        { version: "1.0.0", releasedAt: "2026-01-01T00:00:00Z", changelog: null },
        {
          version: "1.1.0",
          releasedAt: "2026-02-01T00:00:00Z",
          changelog: "Fixed login bug\nImproved performance",
        },
      ],
    });
    expect(mapEntitlementDetail(e).changelog).toEqual([
      {
        version: "1.1.0",
        date: "2026-02-01T00:00:00Z",
        notes: ["Fixed login bug", "Improved performance"],
      },
    ]);
  });

  it("strips tags from instructionsHtml into paragraph strings", () => {
    const e = baseEntitlement({
      instructionsHtml: "<p>Download the installer.</p><p>Run setup.exe as admin.</p>",
    });
    expect(mapEntitlementDetail(e).instructions).toEqual([
      "Download the installer.",
      "Run setup.exe as admin.",
    ]);
  });
});

describe("mapOrderSummaryView", () => {
  function baseOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
    return {
      orderId: "11111111-1111-1111-1111-111111111111",
      orderNo: "CK-ORD-000042",
      type: "product",
      status: "paid",
      total: { amountMinor: 999_00, currency: "INR" },
      itemCount: 1,
      itemsSummary: "Storefront Kit — Lifetime license",
      createdAt: "2026-01-01T00:00:00Z",
      paidAt: "2026-01-01T01:00:00Z",
      expiresAt: null,
      ...overrides,
    };
  }

  it("uses the public order number as `id`, not the internal uuid", () => {
    const view = mapOrderSummaryView(baseOrder());
    expect(view.id).toBe("CK-ORD-000042");
    expect(view.id).not.toBe("11111111-1111-1111-1111-111111111111");
    expect(view.number).toBe("CK-ORD-000042");
  });
});
