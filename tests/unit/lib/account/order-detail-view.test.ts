import { describe, expect, it } from "vitest";
import { mapOrderDetailToOrderView } from "@/lib/account/order-detail-view";
import type { Order, OrderItem } from "../../../../drizzle/schema/commerce";
import type { OrderDetail, OrderPaymentView, OrderRefundView } from "@/modules/orders/types";

function baseOrderRow(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-uuid-1",
    orderNo: "CK-ORD-000042",
    type: "product",
    userId: "user-1",
    clientName: null,
    clientEmail: null,
    clientCompany: null,
    status: "paid",
    currency: "INR",
    subtotalMinor: 100_000,
    discountMinor: 0,
    taxMinor: 18_000,
    totalMinor: 118_000,
    couponId: null,
    customQuoteId: null,
    splitApprovalRequestId: null,
    billingSnapshot: { name: "Jane Buyer", email: "jane@example.com", country: "IN" },
    taxRateBps: 1800,
    taxSnapshot: { rate_bps: 1800, kind: "igst" },
    fxRateToInr: "1",
    expiresAt: null,
    paidAt: new Date("2026-01-02T00:00:00Z"),
    fulfilledAt: null,
    cancelledAt: null,
    refundedAt: null,
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Order;
}

function baseOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-uuid-1",
    offeringId: "offering-1",
    productId: "product-1",
    description: "Storefront Kit — Lifetime license",
    quantity: 1,
    unitMinor: 100_000,
    discountMinor: 0,
    taxMinor: 18_000,
    totalMinor: 118_000,
    ownershipId: null,
    splitSnapshot: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as OrderItem;
}

function baseDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  const order = overrides.order ?? baseOrderRow();
  const items = overrides.items ?? [baseOrderItem({ orderId: order.id })];
  return {
    order,
    items,
    itemMeta: { "item-1": { productName: "Storefront Kit", deliveryType: "download" } },
    payments: [],
    entitlements: [],
    instructionsHtml: "<p>Thank you for your order.</p>",
    refunds: [],
    customerExtra: { tags: [], notes: null },
    ...overrides,
  };
}

function basePayment(overrides: Partial<OrderPaymentView> = {}): OrderPaymentView {
  return {
    paymentId: "pay-1",
    method: "manual_upi",
    status: "confirmed",
    amountDue: { amountMinor: 118_000, currency: "INR" },
    amountReceived: { amountMinor: 118_000, currency: "INR" },
    instructions: {
      method: "manual_upi",
      vpa: "codekraft@upi",
      payeeName: "CodeKraft",
      amount: { amountMinor: 118_000, currency: "INR" },
      note: "CK-ORD-000042",
      upiUri: "upi://pay?pa=codekraft@upi",
      qrDataUrl: "data:image/png;base64,",
    },
    customerReference: "UTR12345678",
    customerSubmittedAt: "2026-01-01T12:00:00Z",
    bankShortfall: null,
    customerCredit: null,
    confirmedByName: null,
    confirmedAt: "2026-01-02T00:00:00Z",
    failureReason: null,
    createdAt: "2026-01-01T12:00:00Z",
    ...overrides,
  };
}

describe("mapOrderDetailToOrderView (SCR-ACC-11)", () => {
  it("maps the order header, line items and tax label", () => {
    const view = mapOrderDetailToOrderView(baseDetail());
    expect(view.id).toBe("order-uuid-1");
    expect(view.number).toBe("CK-ORD-000042");
    expect(view.status).toBe("paid");
    expect(view.productName).toBe("Storefront Kit");
    expect(view.deliveryType).toBe("download");
    expect(view.lines).toEqual([
      {
        name: "Storefront Kit — Lifetime license",
        unit: { amountMinor: 100_000, currency: "INR" },
        quantity: 1,
        discount: undefined,
        taxLabel: "IGST (18%)",
        total: { amountMinor: 118_000, currency: "INR" },
      },
    ]);
    expect(view.subtotal).toEqual({ amountMinor: 100_000, currency: "INR" });
    expect(view.tax).toEqual({ amountMinor: 18_000, currency: "INR" });
    expect(view.total).toEqual({ amountMinor: 118_000, currency: "INR" });
  });

  it("falls back deliveryType to custom and productName to the line description when itemMeta is missing", () => {
    const detail = baseDetail({ itemMeta: {} });
    const view = mapOrderDetailToOrderView(detail);
    expect(view.deliveryType).toBe("custom");
    expect(view.productName).toBe("Storefront Kit — Lifetime license");
  });

  it("reports 'No tax' when taxRateBps is zero, regardless of taxMinor", () => {
    const detail = baseDetail({
      order: baseOrderRow({ taxRateBps: 0, taxSnapshot: null, taxMinor: 0, totalMinor: 100_000 }),
    });
    const view = mapOrderDetailToOrderView(detail);
    expect(view.lines[0]?.taxLabel).toBe("No tax");
    expect(view.tax).toBeNull();
  });

  it("maps billing from the snapshot, folding the single address string into line1", () => {
    const detail = baseDetail({
      order: baseOrderRow({
        billingSnapshot: {
          name: "Jane Buyer",
          email: "jane@example.com",
          country: "IN",
          company: "Acme Co",
          address: "221B Baker Street, Pune",
          gst_number: "27AAAAA0000A1Z5",
        },
      }),
    });
    expect(mapOrderDetailToOrderView(detail).billing).toEqual({
      name: "Jane Buyer",
      company: "Acme Co",
      line1: "221B Baker Street, Pune",
      country: "IN",
      gstNumber: "27AAAAA0000A1Z5",
    });
  });

  it("maps manual_upi payment instructions to the account UI shape", () => {
    const detail = baseDetail({ payments: [basePayment()] });
    const view = mapOrderDetailToOrderView(detail);
    expect(view.instructionsFor).toEqual({
      upi: { vpa: "codekraft@upi", payeeName: "CodeKraft" },
    });
    expect(view.paymentMethod).toBe("manual_upi");
    expect(view.enabledMethods).toEqual(["manual_upi"]);
  });

  it("maps manual_bank payment instructions, renaming accountNo to accountNumber", () => {
    const detail = baseDetail({
      payments: [
        basePayment({
          method: "manual_bank",
          instructions: {
            method: "manual_bank",
            accountName: "CodeKraft Inc.",
            accountNo: "1234567890",
            ifsc: "HDFC0001234",
            bankName: "HDFC Bank",
            swift: "HDFCINBB",
            amount: { amountMinor: 118_000, currency: "INR" },
            reference: "CK-ORD-000042",
          },
        }),
      ],
    });
    expect(mapOrderDetailToOrderView(detail).instructionsFor).toEqual({
      bank: {
        accountName: "CodeKraft Inc.",
        accountNumber: "1234567890",
        ifsc: "HDFC0001234",
        bankName: "HDFC Bank",
        swift: "HDFCINBB",
      },
    });
  });

  it("falls back to an empty instructionsFor when there is no payment yet", () => {
    const view = mapOrderDetailToOrderView(baseDetail({ payments: [] }));
    expect(view.instructionsFor).toEqual({});
    expect(view.enabledMethods).toEqual(["manual_upi", "manual_bank"]);
    expect(view.payment).toBeUndefined();
  });

  it("maps the payment summary fields (status/reference/paidOn/confirmedAt/received)", () => {
    const view = mapOrderDetailToOrderView(baseDetail({ payments: [basePayment()] }));
    expect(view.payment).toEqual({
      status: "confirmed",
      reference: "UTR12345678",
      paidOn: "2026-01-01T12:00:00Z",
      confirmedAt: "2026-01-02T00:00:00Z",
      received: { amountMinor: 118_000, currency: "INR" },
      shortfall: undefined,
      failureReason: undefined,
    });
  });

  it("maps a refund, falling back creditNoteNumber to 'Pending' when no credit note exists yet", () => {
    const detail = baseDetail({
      order: baseOrderRow({ status: "partially_refunded" }),
      refunds: [
        {
          refundId: "ref-1",
          amountMinor: 50_000,
          currency: "INR",
          status: "applied",
          creditNoteNo: null,
          reason: "Customer request",
          createdAt: "2026-01-05T00:00:00Z",
        } satisfies OrderRefundView,
      ],
    });
    const view = mapOrderDetailToOrderView(detail);
    expect(view.refund).toEqual({
      amount: { amountMinor: 50_000, currency: "INR" },
      creditNoteNumber: "Pending",
      revokedAt: undefined,
    });
  });

  it("only sets refund.revokedAt when the order status is fully refunded", () => {
    const detail = baseDetail({
      order: baseOrderRow({ status: "refunded", refundedAt: new Date("2026-01-10T00:00:00Z") }),
      refunds: [
        {
          refundId: "ref-1",
          amountMinor: 118_000,
          currency: "INR",
          status: "applied",
          creditNoteNo: "CK/2026-27/CN-0001",
          reason: "Full refund",
          createdAt: "2026-01-10T00:00:00Z",
        } satisfies OrderRefundView,
      ],
    });
    const view = mapOrderDetailToOrderView(detail);
    expect(view.refund?.creditNoteNumber).toBe("CK/2026-27/CN-0001");
    expect(view.refund?.revokedAt).toBe("2026-01-10T00:00:00.000Z");
  });

  it.each([
    ["failed" as const, "expired" as const],
    ["cancelled" as const, "cancelled_by_customer" as const],
    ["paid" as const, undefined],
  ])("maps order status %s to failedReason %s", (status, expected) => {
    const view = mapOrderDetailToOrderView(baseDetail({ order: baseOrderRow({ status }) }));
    expect(view.failedReason).toBe(expected);
  });

  it.each([
    ["paid" as const, true],
    ["fulfilled" as const, true],
    ["partially_refunded" as const, true],
    ["pending_payment" as const, false],
    ["cancelled" as const, false],
  ])(
    "refundable is true only for paid/fulfilled/partially_refunded (status=%s)",
    (status, expected) => {
      expect(
        mapOrderDetailToOrderView(baseDetail({ order: baseOrderRow({ status }) })).refundable,
      ).toBe(expected);
    },
  );

  it("maps entitlementId from the first linked entitlement, and invoiceNumber from invoice", () => {
    const detail = baseDetail({
      entitlements: [{ entitlementId: "ent-1", deliveryType: "download", status: "active" }],
      invoice: { invoiceId: "inv-1", invoiceNo: "CK/2026-27/0001" },
    });
    const view = mapOrderDetailToOrderView(detail);
    expect(view.entitlementId).toBe("ent-1");
    expect(view.invoiceNumber).toBe("CK/2026-27/0001");
  });

  it("marks purchaseModelLine as a custom quote only when the order came from one", () => {
    expect(mapOrderDetailToOrderView(baseDetail()).purchaseModelLine).toBe("One-time purchase");
    const withQuote = mapOrderDetailToOrderView(
      baseDetail({ quote: { id: "quote-1", title: "Custom build" } }),
    );
    expect(withQuote.purchaseModelLine).toBe("Custom quote");
  });

  it("strips HTML tags from instructionsHtml into postPurchaseInstructions paragraphs", () => {
    const detail = baseDetail({
      instructionsHtml:
        "<p>Check your email for a welcome message.</p><p>Access unlocks within an hour.</p>",
    });
    expect(mapOrderDetailToOrderView(detail).postPurchaseInstructions).toEqual([
      "Check your email for a welcome message.",
      "Access unlocks within an hour.",
    ]);
  });

  it("applies the coupon code to a discount line only when a discount was actually applied", () => {
    const withDiscount = mapOrderDetailToOrderView(
      baseDetail({
        order: baseOrderRow({ discountMinor: 10_000 }),
        coupon: { code: "LAUNCH10", discountMinor: 10_000 },
      }),
    );
    expect(withDiscount.discount).toEqual({
      code: "LAUNCH10",
      amount: { amountMinor: 10_000, currency: "INR" },
    });

    const withoutDiscount = mapOrderDetailToOrderView(baseDetail());
    expect(withoutDiscount.discount).toBeUndefined();
  });
});
