// @vitest-environment node
/**
 * P2.6 — domain B contracts (orders, payments, coupons, quotes, invoices, finance, approvals,
 * audit): Zod samples from the docs/06 rows, export walks, frozen-name fixtures (master plan §5,
 * docs/06 §4.1) and property tests of the pure reference implementations.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";
import { allocateLargestRemainder } from "@/lib/money";
import type { AuditEvent } from "@/lib/audit-port";
import type { TxCtx } from "@/lib/db";
import { anonymousContext, buildContext } from "@/lib/authz/context";
import { approvalType as approvalTypeEnum } from "../../../drizzle/schema/approvals";
import {
  entryType as entryTypeEnum,
  partyType as partyTypeEnum,
} from "../../../drizzle/schema/finance";

import * as orders from "@/modules/orders";
import * as payments from "@/modules/payments";
import * as coupons from "@/modules/coupons";
import * as quotes from "@/modules/quotes";
import * as invoices from "@/modules/invoices";
import * as finance from "@/modules/finance";
import * as approvals from "@/modules/approvals";
import * as audit from "@/modules/audit";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";

const billing = { name: "Asha Rao", email: "asha@example.test", country: "in" };

function isZod(v: unknown): v is z.ZodType {
  return v instanceof z.ZodType;
}

function zodExports(mod: Record<string, unknown>): string[] {
  return Object.entries(mod)
    .filter(([, v]) => isZod(v))
    .map(([k]) => k);
}

// ---------------------------------------------------------------------------------------------
// Export walk
// ---------------------------------------------------------------------------------------------

describe("export walk — every *Input / *Payload export is a Zod schema", () => {
  const modules = { orders, payments, coupons, quotes, invoices, finance, approvals, audit };
  const expectedMin: Record<keyof typeof modules, number> = {
    orders: 12,
    payments: 8,
    coupons: 4,
    quotes: 6,
    invoices: 6,
    finance: 12,
    approvals: 14,
    audit: 4,
  };

  for (const [name, mod] of Object.entries(modules) as [
    keyof typeof modules,
    Record<string, unknown>,
  ][]) {
    it(`${name} exposes at least ${String(expectedMin[name])} schemas, all with safeParse`, () => {
      const schemas = zodExports(mod);
      expect(schemas.length).toBeGreaterThanOrEqual(expectedMin[name]);
      for (const key of schemas) {
        expect(typeof (mod[key] as z.ZodType).safeParse).toBe("function");
      }
      for (const key of Object.keys(mod)) {
        if (/(Input|Payload)$/.test(key) && !/^(is|to|compute|parse)/.test(key)) {
          expect(isZod(mod[key]), `${name}.${key} should be a Zod schema`).toBe(true);
        }
      }
    });
  }

  it("object inputs are strict (unknown keys rejected)", () => {
    const strictSamples: [z.ZodType, unknown][] = [
      [
        payments.confirmPaymentInput,
        {
          paymentId: U1,
          amountReceivedMinor: 1,
          reference: "r",
          receivedOn: "2026-09-25",
          extra: 1,
        },
      ],
      [
        orders.createOrderInput,
        { offeringId: U1, paymentMethod: "manual_upi", billing, extra: true },
      ],
      [
        finance.recordPayoutInput,
        {
          partnerId: U1,
          amountMinor: 1,
          currency: "INR",
          paidOn: "2026-09-25",
          reference: "x",
          extra: 1,
        },
      ],
      [approvals.approveRequestInput, { approvalRequestId: U1, extra: 1 }],
      [audit.listAuditLogsInput, { limit: 10, extra: 1 }],
    ];
    for (const [schema, sample] of strictSamples)
      expect(schema.safeParse(sample).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Shared primitives (docs/06 §1.3, §1.8, §1.9)
// ---------------------------------------------------------------------------------------------

describe("shared primitives", () => {
  it("Money is integer, non-negative minor units with one of five currencies", () => {
    expect(orders.zMoney.safeParse({ amountMinor: 12345, currency: "INR" }).success).toBe(true);
    expect(orders.zMoney.safeParse({ amountMinor: 12.5, currency: "INR" }).success).toBe(false);
    expect(orders.zMoney.safeParse({ amountMinor: -1, currency: "INR" }).success).toBe(false);
    expect(orders.zMoney.safeParse({ amountMinor: 1, currency: "JPY" }).success).toBe(false);
    expect(
      orders.zMoney.safeParse({ amountMinor: Number.MAX_SAFE_INTEGER + 2, currency: "INR" })
        .success,
    ).toBe(false);
  });

  it("bps is 0..10000; dates are YYYY-MM-DD; timestamps ISO-8601", () => {
    expect(orders.zBps.safeParse(10_000).success).toBe(true);
    expect(orders.zBps.safeParse(10_001).success).toBe(false);
    expect(orders.zIsoDate.safeParse("2026-09-25").success).toBe(true);
    expect(orders.zIsoDate.safeParse("25/09/2026").success).toBe(false);
    expect(orders.zIsoTimestamp.safeParse("2026-09-24T10:15:00.000Z").success).toBe(true);
    expect(orders.zIsoTimestamp.safeParse("2026-09-24 10:15").success).toBe(false);
  });

  it("list params default limit 25, cap 100, and only allow declared sort fields", () => {
    const parsed = orders.listOrdersAdminInput.parse({});
    expect(parsed.limit).toBe(25);
    expect(orders.listOrdersAdminInput.safeParse({ limit: 101 }).success).toBe(false);
    expect(orders.listOrdersAdminInput.safeParse({ sort: "total:desc" }).success).toBe(true);
    expect(orders.listOrdersAdminInput.safeParse({ sort: "email:asc" }).success).toBe(false);
    expect(
      orders.listOrdersAdminInput.safeParse({ filters: { status: "paid", nope: 1 } }).success,
    ).toBe(false);
    expect(finance.listLedgerEntriesInput.safeParse({ sort: "createdAt:asc" }).success).toBe(false);
    expect(finance.listLedgerEntriesInput.safeParse({ sort: "seq:asc" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------------------------

describe("orders schemas", () => {
  it("createOrder (API-COM-02) accepts the docs row and rejects gateway methods", () => {
    const ok = orders.createOrderInput.safeParse({
      offeringId: U1,
      couponCode: "welcome10",
      paymentMethod: "manual_bank",
      billing: { ...billing, gstNumber: "27abcde1234f1z5" },
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.couponCode).toBe("WELCOME10");
      expect(ok.data.billing.country).toBe("IN");
      expect(ok.data.billing.gstNumber).toBe("27ABCDE1234F1Z5");
    }
    expect(
      orders.createOrderInput.safeParse({ offeringId: U1, paymentMethod: "razorpay", billing })
        .success,
    ).toBe(false);
    expect(
      orders.createOrderInput.safeParse({
        offeringId: U1,
        paymentMethod: "manual_upi",
        billing: { ...billing, gstNumber: "bad" },
      }).success,
    ).toBe(false);
  });

  it("createManualOrder (API-COM-07) project order with splitSnapshot lines", () => {
    const valid = {
      type: "project",
      customer: { clientName: "ACME", clientEmail: "cto@acme.test" },
      currency: "INR",
      items: [
        {
          description: "Discovery workshop",
          unitMinor: 5_000_000,
          splitSnapshot: {
            companyCutBps: 1000,
            lines: [
              { partnerId: U1, shareBps: 6000 },
              { partnerId: U2, shareBps: 4000 },
            ],
          },
        },
      ],
      taxEnabled: true,
      billing,
    };
    const parsed = orders.createManualOrderInput.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const line = parsed.data.items[0]!;
      expect(orders.isProjectLine(line)).toBe(true);
      expect(line).toMatchObject({ quantity: 1 });
      if (orders.isProjectLine(line)) {
        expect(orders.toSplitSnapshot(line.splitSnapshot)).toEqual({
          company_cut_bps: 1000,
          lines: [
            { partner_id: U1, share_bps: 6000 },
            { partner_id: U2, share_bps: 4000 },
          ],
        });
      }
    }

    const badSum = structuredClone(valid);
    badSum.items[0]!.splitSnapshot.lines[1]!.shareBps = 3999;
    expect(orders.createManualOrderInput.safeParse(badSum).success).toBe(false);

    const dupPartner = structuredClone(valid);
    dupPartner.items[0]!.splitSnapshot.lines[1]!.partnerId = U1;
    expect(orders.createManualOrderInput.safeParse(dupPartner).success).toBe(false);

    // Project lines on a product order, and vice versa, are VALIDATION failures.
    expect(orders.createManualOrderInput.safeParse({ ...valid, type: "product" }).success).toBe(
      false,
    );
    expect(
      orders.createManualOrderInput.safeParse({
        ...valid,
        type: "product",
        items: [{ offeringId: U3 }],
        customer: { userId: U2 },
        payment: {
          method: "manual_bank",
          amountReceivedMinor: 5_000_000,
          reference: "UTR1",
          paidOn: "2026-09-25",
        },
      }).success,
    ).toBe(true);
    // Payment on a project order is refused up front (split not applied yet).
    expect(
      orders.createManualOrderInput.safeParse({
        ...valid,
        payment: {
          method: "manual_bank",
          amountReceivedMinor: 1,
          reference: "r",
          paidOn: "2026-09-25",
        },
      }).success,
    ).toBe(false);
  });

  it("order state machine matches docs/03 / MASTER_SPEC §7", () => {
    expect(orders.ORDER_STATUS_TRANSITIONS.pending_payment).toEqual([
      "paid",
      "failed",
      "cancelled",
    ]);
    expect(orders.ORDER_STATUS_TRANSITIONS.refunded).toEqual([]);
    expect(orders.ORDER_EXPIRY_DAYS).toBe(7);
  });

  it("tax rule (BR-08, D-1501) and fulfilment rule (MASTER_SPEC §7)", () => {
    expect(
      orders.taxRateBpsFor({ productTaxEnabled: true, gstin: null, settingsTaxRateBps: 1800 }),
    ).toBe(0);
    expect(
      orders.taxRateBpsFor({
        productTaxEnabled: true,
        gstin: "27ABCDE1234F1Z5",
        settingsTaxRateBps: 1800,
      }),
    ).toBe(1800);
    expect(
      orders.taxRateBpsFor({
        productTaxEnabled: false,
        gstin: "27ABCDE1234F1Z5",
        settingsTaxRateBps: 1800,
      }),
    ).toBe(0);
    expect(
      orders.isFulfilled({
        entitlements: [{ status: "active" }],
        serviceChecklists: [{ complete: true }],
      }),
    ).toBe(true);
    expect(
      orders.isFulfilled({
        entitlements: [{ status: "active" }, { status: "pending" }],
        serviceChecklists: [],
      }),
    ).toBe(false);
    expect(orders.isFulfilled({ entitlements: [], serviceChecklists: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------------------------

describe("payments schemas", () => {
  it("confirmPayment (API-PAY-03) valid / invalid samples", () => {
    const ok = payments.confirmPaymentInput.safeParse({
      paymentId: U1,
      amountReceivedMinor: 0,
      reference: " HDFC-UTR-123 ",
      receivedOn: "2026-09-25",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.overrideExpiry).toBe(false);
      expect(ok.data.reference).toBe("HDFC-UTR-123");
    }
    expect(
      payments.confirmPaymentInput.safeParse({
        paymentId: U1,
        amountReceivedMinor: -1,
        reference: "r",
        receivedOn: "2026-09-25",
      }).success,
    ).toBe(false);
    expect(
      payments.confirmPaymentInput.safeParse({
        paymentId: U1,
        amountReceivedMinor: 10.5,
        reference: "r",
        receivedOn: "2026-09-25",
      }).success,
    ).toBe(false);
    expect(
      payments.confirmPaymentInput.safeParse({
        paymentId: U1,
        amountReceivedMinor: 1,
        reference: "",
        receivedOn: "2026-09-25",
      }).success,
    ).toBe(false);
    expect(
      payments.confirmPaymentInput.safeParse({
        paymentId: U1,
        amountReceivedMinor: 1,
        reference: "r",
        receivedOn: "2026-09-25T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      payments.confirmPaymentInput.safeParse({
        paymentId: "not-a-uuid",
        amountReceivedMinor: 1,
        reference: "r",
        receivedOn: "2026-09-25",
      }).success,
    ).toBe(false);
  });

  it("submitPaymentReference (API-PAY-02) reference 6..64", () => {
    expect(
      payments.submitPaymentReferenceInput.safeParse({ paymentId: U1, reference: "12345" }).success,
    ).toBe(false);
    expect(
      payments.submitPaymentReferenceInput.safeParse({
        paymentId: U1,
        reference: "123456",
        paidAt: "2026-09-24T10:15:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("proposeRefund (API-PAY-05) defaults and positive amount", () => {
    const ok = payments.proposeRefundInput.parse({
      orderId: U1,
      paymentId: U2,
      amountMinor: 100,
      reason: "duplicate",
    });
    expect(ok.revokeEntitlements).toBe(true);
    expect(ok.policyException).toBe(false);
    expect(
      payments.proposeRefundInput.safeParse({
        orderId: U1,
        paymentId: U2,
        amountMinor: 0,
        reason: "x",
      }).success,
    ).toBe(false);
  });

  it("payment state machine: confirmed → refunded only (MASTER_SPEC §7)", () => {
    expect(payments.PAYMENT_STATUS_TRANSITIONS.confirmed).toEqual(["refunded"]);
    expect(payments.PAYMENT_STATUS_TRANSITIONS.refunded).toEqual([]);
    expect(payments.PAYMENT_STATUS_TRANSITIONS.failed).toEqual([]);
  });
});

describe("PaymentProvider contract (docs/06 §4.1)", () => {
  it("method and parameter names match the docs fixture", () => {
    expect(payments.PAYMENT_PROVIDER_CONTRACT).toEqual({
      keys: [],
      createIntent: ["ctx", "order", "method"],
      confirm: ["ctx", "payment", "input"],
      refund: ["ctx", "payment", "amountMinor", "reason"],
      handleWebhook: ["req"],
    });
    expect(payments.PAYMENT_METHOD_KEYS).toEqual([
      "manual_upi",
      "manual_bank",
      "razorpay",
      "stripe",
      "paypal",
    ]);
    expect(payments.MANUAL_PROVIDER_KEYS).toEqual(["manual_upi", "manual_bank"]);
  });

  it("a fake manual provider satisfies the interface and confirm never sees ledger types", () => {
    const fake: payments.PaymentProvider = {
      keys: ["manual_upi", "manual_bank"],
      async createIntent(_ctx, order, method) {
        const instructions: payments.PaymentInstructions =
          method === "manual_upi"
            ? {
                method,
                vpa: "ck@upi",
                payeeName: "CodeKraft",
                amount: order.amountDue,
                note: order.orderNo,
                upiUri: "upi://pay",
                qrDataUrl: "data:",
              }
            : {
                method: "manual_bank",
                accountName: "CodeKraft",
                accountNo: "1",
                ifsc: "HDFC0000001",
                bankName: "HDFC",
                amount: order.amountDue,
                reference: order.orderNo,
              };
        return { instructions };
      },
      async confirm(_ctx, payment, input) {
        const amounts = payments.computeManualConfirmAmounts(
          payment.amountDueMinor,
          input.amountReceivedMinor,
        );
        return { status: "confirmed", reference: input.reference, ...amounts };
      },
    };
    expectTypeOf(fake).toMatchTypeOf<payments.PaymentProvider>();
    expectTypeOf<Parameters<payments.PaymentProvider["confirm"]>>().toEqualTypeOf<
      [TxCtx, payments.PaymentRow, payments.ConfirmInput]
    >();
    expectTypeOf<
      Awaited<ReturnType<payments.PaymentProvider["confirm"]>>
    >().toEqualTypeOf<payments.PaymentResult>();
    // The result carries only amounts + reference, never ledger / order shapes.
    expectTypeOf<keyof payments.PaymentResult>().toEqualTypeOf<
      | "status"
      | "amountReceivedMinor"
      | "gatewayFeeMinor"
      | "bankShortfallMinor"
      | "customerCreditMinor"
      | "reference"
      | "providerPayload"
      | "failureReason"
    >();
  });

  it("computeManualConfirmAmounts: received + shortfall − credit = due, never both non-zero", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000_000_000 }),
        fc.nat({ max: 10_000_000_000 }),
        (due, received) => {
          const r = payments.computeManualConfirmAmounts(due, received);
          expect(r.gatewayFeeMinor).toBe(0);
          expect(r.amountReceivedMinor + r.bankShortfallMinor - r.customerCreditMinor).toBe(due);
          expect(r.bankShortfallMinor === 0 || r.customerCreditMinor === 0).toBe(true);
          expect(r.bankShortfallMinor).toBeGreaterThanOrEqual(0);
          expect(r.customerCreditMinor).toBeGreaterThanOrEqual(0);
        },
      ),
    );
    expect(payments.computeManualConfirmAmounts(1000, 900)).toEqual({
      amountReceivedMinor: 900,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 100,
      customerCreditMinor: 0,
    });
    expect(payments.computeManualConfirmAmounts(1000, 1250)).toEqual({
      amountReceivedMinor: 1250,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 0,
      customerCreditMinor: 250,
    });
    expect(() => payments.computeManualConfirmAmounts(1000, -1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------------------------
// Coupons, quotes, invoices
// ---------------------------------------------------------------------------------------------

describe("coupons / quotes / invoices schemas", () => {
  it("upsertCoupon (API-COM-08): percent ≤ 10000 bps without currency; fixed needs currency", () => {
    expect(
      coupons.upsertCouponInput.safeParse({ code: "WELCOME10", kind: "percent", value: 1000 })
        .success,
    ).toBe(true);
    expect(
      coupons.upsertCouponInput.safeParse({ code: "WELCOME10", kind: "percent", value: 10_001 })
        .success,
    ).toBe(false);
    expect(
      coupons.upsertCouponInput.safeParse({
        code: "WELCOME10",
        kind: "percent",
        value: 1000,
        currency: "INR",
      }).success,
    ).toBe(false);
    expect(
      coupons.upsertCouponInput.safeParse({ code: "FLAT500", kind: "fixed", value: 50_000 })
        .success,
    ).toBe(false);
    expect(
      coupons.upsertCouponInput.safeParse({
        code: "FLAT500",
        kind: "fixed",
        value: 50_000,
        currency: "INR",
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2025-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      coupons.computeCouponDiscount("percent", 1000, { amountMinor: 99_999, currency: "INR" }),
    ).toBe(10_000);
    expect(
      coupons.computeCouponDiscount("fixed", 50_000, { amountMinor: 30_000, currency: "INR" }),
    ).toBe(30_000);
  });

  it("quotes (API-COM-09/10): token shape, accept needs billing + manual method", () => {
    expect(
      quotes.createCustomQuoteInput.safeParse({
        customerId: U1,
        title: "MIS portal",
        currency: "INR",
        amountMinor: 25_000_000,
      }).success,
    ).toBe(true);
    expect(
      quotes.createCustomQuoteInput.safeParse({
        customerId: U1,
        title: "",
        currency: "INR",
        amountMinor: 1,
      }).success,
    ).toBe(false);
    const token = "a".repeat(32);
    expect(quotes.getQuoteInput.safeParse({ token }).success).toBe(true);
    expect(quotes.getQuoteInput.safeParse({ token: "short" }).success).toBe(false);
    expect(
      quotes.acceptCustomQuoteInput.safeParse({ token, paymentMethod: "manual_upi", billing })
        .success,
    ).toBe(true);
    expect(quotes.QUOTE_STATUS_TRANSITIONS.paid).toEqual([]);
  });

  it("invoices (API-COM-11..13): numbering formats, pdf url input union, fy filter", () => {
    expect(invoices.zInvoiceNo.safeParse("CK/2026-27/0001").success).toBe(true);
    expect(invoices.zCreditNo.safeParse("CK/CN/2026-27/0001").success).toBe(true);
    expect(invoices.zInvoiceNo.safeParse("CK-2026-0001").success).toBe(false);
    expect(invoices.getInvoicePdfUrlInput.safeParse({ invoiceId: U1 }).success).toBe(true);
    expect(invoices.getInvoicePdfUrlInput.safeParse({ creditNoteId: U1 }).success).toBe(true);
    expect(
      invoices.getInvoicePdfUrlInput.safeParse({ invoiceId: U1, creditNoteId: U2 }).success,
    ).toBe(false);
    expect(invoices.listInvoicesAdminInput.safeParse({ filters: { fy: "2026-27" } }).success).toBe(
      true,
    );
    expect(invoices.listInvoicesAdminInput.safeParse({ filters: { fy: "2026" } }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------------------------

describe("finance schemas and enums", () => {
  it("entry / party enums mirror drizzle/schema/finance; report keys include customer_credits", () => {
    expect([...finance.ENTRY_TYPES]).toEqual([...entryTypeEnum.enumValues]);
    expect([...finance.PARTY_TYPES]).toEqual([...partyTypeEnum.enumValues]);
    expect(finance.REPORT_KEYS).toContain("customer_credits");
    expect(finance.REPORT_KEYS).toHaveLength(8);
    expect(finance.REFUND_REVERSAL.gateway_fee).toBeUndefined();
    expect(finance.REFUND_REVERSAL.bank_charge).toBeUndefined();
    expect(finance.REFUND_REVERSAL.partner_allocation).toBe("refund_partner_allocation");
  });

  it("recordPayout / recordExpense / proposeAdjustment / getReport / exportStatement samples", () => {
    expect(
      finance.recordPayoutInput.safeParse({
        partnerId: U1,
        amountMinor: 100_000,
        currency: "INR",
        paidOn: "2026-09-25",
        reference: "NEFT123",
      }).success,
    ).toBe(true);
    expect(
      finance.recordPayoutInput.safeParse({
        partnerId: U1,
        amountMinor: 0,
        currency: "INR",
        paidOn: "2026-09-25",
        reference: "NEFT123",
      }).success,
    ).toBe(false);
    expect(
      finance.recordPayoutInput.safeParse({
        partnerId: U1,
        amountMinor: 1,
        currency: "INR",
        paidOn: "2026-09-25",
        reference: "x".repeat(121),
      }).success,
    ).toBe(false);

    expect(
      finance.recordExpenseInput.safeParse({
        productId: U1,
        category: "hosting",
        amountMinor: 5000,
        currency: "INR",
        incurredOn: "2026-09-01",
      }).success,
    ).toBe(true);
    expect(
      finance.recordExpenseInput.safeParse({
        category: "hosting",
        amountMinor: 5000,
        currency: "INR",
        incurredOn: "2026-09-01",
        sharedBySplit: false,
      }).success,
    ).toBe(true);
    expect(
      finance.recordExpenseInput.safeParse({
        category: "hosting",
        amountMinor: 5000,
        currency: "INR",
        incurredOn: "2026-09-01",
      }).success,
    ).toBe(false);

    const adj = {
      lines: [
        {
          partyType: "partner",
          partnerId: U1,
          amountMinor: -500,
          currency: "INR",
          memo: "correction",
        },
        { partyType: "company", amountMinor: 500, currency: "INR", memo: "correction" },
      ],
      reason: "mis-split",
    };
    expect(finance.proposeAdjustmentInput.safeParse(adj).success).toBe(true);
    expect(finance.proposeAdjustmentInput.safeParse({ lines: [], reason: "x" }).success).toBe(
      false,
    );
    expect(
      finance.proposeAdjustmentInput.safeParse({
        lines: [{ partyType: "partner", amountMinor: 1, currency: "INR", memo: "m" }],
        reason: "x",
      }).success,
    ).toBe(false);
    expect(
      finance.proposeAdjustmentInput.safeParse({
        lines: [{ partyType: "company", amountMinor: 0, currency: "INR", memo: "m" }],
        reason: "x",
      }).success,
    ).toBe(false);

    expect(
      finance.getReportInput.safeParse({
        report: "customer_credits",
        dateFrom: "2026-04-01",
        dateTo: "2027-03-31",
        granularity: "fy",
        currency: "INR",
      }).success,
    ).toBe(true);
    expect(
      finance.getReportInput.safeParse({
        report: "revenue",
        dateFrom: "2026-04-01",
        dateTo: "2027-03-31",
      }).success,
    ).toBe(false);
    expect(
      finance.getReportInput.safeParse({
        report: "refunds",
        dateFrom: "2026-04-02",
        dateTo: "2026-04-01",
      }).success,
    ).toBe(false);
    expect(
      finance.exportStatementInput.safeParse({
        partnerId: U1,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        format: "csv",
      }).success,
    ).toBe(true);
    expect(
      finance.exportStatementInput.safeParse({
        partnerId: U1,
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        format: "xlsx",
      }).success,
    ).toBe(false);
  });

  it("computeAllocation input: shares sum to 10000, deductions ≤ gross", () => {
    const base = {
      currency: "INR",
      grossMinor: 100_000,
      discountMinor: 10_000,
      taxMinor: 16_200,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 50,
      companyCutBps: 1000,
      lines: [
        { partnerId: U1, shareBps: 6000 },
        { partnerId: U2, shareBps: 4000 },
      ],
    };
    expect(finance.computeAllocationInput.safeParse(base).success).toBe(true);
    expect(
      finance.computeAllocationInput.safeParse({
        ...base,
        lines: [{ partnerId: U1, shareBps: 6000 }],
      }).success,
    ).toBe(false);
    expect(
      finance.computeAllocationInput.safeParse({ ...base, discountMinor: 100_001 }).success,
    ).toBe(false);
    expect(finance.computeAllocationInput.safeParse({ ...base, grossMinor: 100.5 }).success).toBe(
      false,
    );
    expect(finance.computeAllocationInput.safeParse({ ...base, lines: [] }).success).toBe(false);
  });

  it("posting method names match master plan §5", () => {
    expect(finance.FINANCE_POSTING_METHODS).toEqual([
      "postOrderPaid",
      "postRefund",
      "postPayout",
      "postExpense",
      "postAdjustment",
    ]);
    expectTypeOf<Parameters<finance.FinanceService["postOrderPaid"]>>().toEqualTypeOf<
      [string, TxCtx]
    >();
    expectTypeOf<Parameters<finance.FinanceService["postRefund"]>>().toEqualTypeOf<
      [string, TxCtx]
    >();
    expectTypeOf<Parameters<finance.FinanceService["postAdjustment"]>>().toEqualTypeOf<
      [string, TxCtx]
    >();
  });
});

describe("computeAllocationReference (docs/06 §4.2)", () => {
  it("worked example: 60/40 with 10 % cut", () => {
    const r = finance.computeAllocationReference({
      currency: "INR",
      grossMinor: 100_000,
      discountMinor: 10_000,
      taxMinor: 16_200,
      gatewayFeeMinor: 0,
      bankShortfallMinor: 50,
      companyCutBps: 1000,
      lines: [
        { partnerId: U1, shareBps: 6000 },
        { partnerId: U2, shareBps: 4000 },
      ],
    });
    expect(r.distributableMinor).toBe(73_750);
    expect(r.companyMinor).toBe(7_375);
    expect(r.lines).toEqual([
      { partner_id: U1, share_bps: 6000, amount_minor: 39_825 },
      { partner_id: U2, share_bps: 4000, amount_minor: 26_550 },
    ]);
    expect(r.companyMinor + 39_825 + 26_550).toBe(r.distributableMinor);
  });

  const sharesArb = fc
    .array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 8 })
    .map((weights) => allocateLargestRemainder(10_000, weights))
    .map((shares) =>
      shares.map((shareBps, i) => ({
        partnerId: `${String(i + 1).repeat(8)}-0000-4000-8000-000000000000`,
        shareBps,
      })),
    );

  const inputArb = fc
    .record({
      gross: fc.nat({ max: 1_000_000_000_000 }),
      d1: fc.nat({ max: 10_000 }),
      d2: fc.nat({ max: 10_000 }),
      d3: fc.nat({ max: 10_000 }),
      d4: fc.nat({ max: 10_000 }),
      companyCutBps: fc.integer({ min: 0, max: 10_000 }),
      lines: sharesArb,
    })
    .map(({ gross, d1, d2, d3, d4, companyCutBps, lines }) => {
      // Deductions as bps shares of gross so they never exceed it.
      const [discountMinor, taxMinor, gatewayFeeMinor, bankShortfallMinor] =
        allocateLargestRemainder(gross, [d1, d2, d3, d4, 40_000]);
      return {
        currency: "INR" as const,
        grossMinor: gross,
        discountMinor: discountMinor!,
        taxMinor: taxMinor!,
        gatewayFeeMinor: gatewayFeeMinor!,
        bankShortfallMinor: bankShortfallMinor!,
        companyCutBps,
        lines,
      };
    });

  it("Σ lines + company = distributable, exactly, for every input", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const r = finance.computeAllocationReference(input);
        const expectedDistributable =
          input.grossMinor -
          input.discountMinor -
          input.taxMinor -
          input.gatewayFeeMinor -
          input.bankShortfallMinor;
        expect(r.distributableMinor).toBe(expectedDistributable);
        const sum = r.lines.reduce((acc, l) => acc + l.amount_minor, 0);
        expect(sum + r.companyMinor).toBe(r.distributableMinor);
        for (const l of r.lines) expect(l.amount_minor).toBeGreaterThanOrEqual(0);
        expect(r.companyMinor).toBeGreaterThanOrEqual(0);
        expect(r.companyMinor).toBeLessThanOrEqual(r.distributableMinor);
      }),
      { numRuns: 300 },
    );
  });

  it("every partner line is within one minor unit of its ideal share and the result is deterministic", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const a = finance.computeAllocationReference(input);
        const b = finance.computeAllocationReference(input);
        expect(b).toEqual(a);
        const pool = BigInt(a.distributableMinor - a.companyMinor);
        a.lines.forEach((l) => {
          const ideal = (pool * BigInt(l.share_bps)) / 10_000n;
          const diff = BigInt(l.amount_minor) - ideal;
          expect(diff === 0n || diff === 1n).toBe(true);
        });
      }),
      { numRuns: 200 },
    );
  });

  it("spreadDeductionReference sums exactly across items", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000_000 }),
        fc.array(fc.nat({ max: 1_000_000_000 }), { minLength: 1, maxLength: 10 }),
        (total, itemTotals) => {
          const parts = finance.spreadDeductionReference(total, itemTotals);
          expect(parts).toHaveLength(itemTotals.length);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        },
      ),
    );
    expect(finance.spreadDeductionReference(7, [0, 0])).toEqual([7, 0]);
    expect(() => finance.spreadDeductionReference(7, [])).toThrow(RangeError);
  });

  it("rejects invalid input through the Zod schema", () => {
    expect(() =>
      finance.computeAllocationReference({
        currency: "INR",
        grossMinor: 10,
        discountMinor: 20,
        taxMinor: 0,
        gatewayFeeMinor: 0,
        bankShortfallMinor: 0,
        companyCutBps: 0,
        lines: [{ partnerId: U1, shareBps: 10_000 }],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------------------------

describe("approvals", () => {
  it("nine types, matching drizzle/schema/approvals, each with a payload schema", () => {
    expect(approvals.APPROVAL_TYPES).toHaveLength(9);
    expect([...approvals.APPROVAL_TYPES]).toEqual([...approvalTypeEnum.enumValues]);
    for (const t of approvals.APPROVAL_TYPES) {
      expect(isZod(approvals.approvalPayloadSchemas[t])).toBe(true);
      expect(approvals.APPROVAL_TYPE_INFO[t].applyApi).toMatch(/^API-[A-Z]+-\d{2}$/);
    }
    expect(approvals.APPROVALS_CONTRACT_METHODS).toEqual([
      "request",
      "decide",
      "execute",
      "registerApplyHandler",
      "registerRejectHandler",
    ]);
  });

  const validPayloads: { [T in approvals.ApprovalType]: approvals.ApprovalPayloadMap[T] } = {
    "product.publish": { productId: U1, publishAt: "2026-10-01T00:00:00.000Z" },
    "ownership.change": { ownershipId: U1 },
    "ledger.adjustment": {
      lines: [{ partyType: "company", amountMinor: 100, currency: "INR", memo: "fix" }],
      reason: "typo",
    },
    "refund.issue": { refundId: U1 },
    "payout.record": {
      partnerId: U1,
      amountMinor: 100_000,
      currency: "INR",
      paidOn: "2026-09-25",
      reference: "NEFT1",
    },
    "product.archive": { productId: U1, reason: "end of life" },
    "product.delete": { productId: U1, reason: "never sold" },
    "admin.user_change": {
      kind: "invite",
      email: "new@codekraft.test",
      role: "admin",
      partner: { displayName: "New Partner" },
    },
    "project_order.split": { orderId: U1 },
  };

  const invalidPayloads: Record<approvals.ApprovalType, unknown> = {
    "product.publish": { productId: "x" },
    "ownership.change": {},
    "ledger.adjustment": { lines: [], reason: "" },
    "refund.issue": { refundId: U1, amountMinor: 1 },
    "payout.record": {
      partnerId: U1,
      amountMinor: -1,
      currency: "INR",
      paidOn: "2026-09-25",
      reference: "r",
    },
    "product.archive": { productId: U1 },
    "product.delete": { productId: U1, reason: "" },
    "admin.user_change": { kind: "invite", email: "not-an-email", role: "admin" },
    "project_order.split": { orderId: 5 },
  };

  for (const t of approvals.APPROVAL_TYPES) {
    it(`payload ${t}: accepts the docs sample and rejects a broken one`, () => {
      expect(approvals.approvalPayloadSchemas[t].safeParse(validPayloads[t]).success).toBe(true);
      expect(approvals.approvalPayloadSchemas[t].safeParse(invalidPayloads[t]).success).toBe(false);
      expect(approvals.parseApprovalPayload(t, validPayloads[t])).toEqual(validPayloads[t]);
      expect(() => approvals.parseApprovalPayload(t, invalidPayloads[t])).toThrow();
    });
  }

  it("admin.user_change variants (API-ADM-11)", () => {
    expect(
      approvals.adminUserChangePayload.safeParse({
        kind: "change_role",
        userId: U1,
        role: "super_admin",
      }).success,
    ).toBe(true);
    expect(approvals.adminUserChangePayload.safeParse({ kind: "remove", userId: U1 }).success).toBe(
      true,
    );
    expect(
      approvals.adminUserChangePayload.safeParse({
        kind: "change_role",
        userId: U1,
        role: "customer",
      }).success,
    ).toBe(false);
  });

  it("requestApprovalInput validates the payload against the type", () => {
    expect(
      approvals.requestApprovalInput.safeParse({
        type: "refund.issue",
        subject: { type: "refund", id: U1 },
        payload: { refundId: U1 },
      }).success,
    ).toBe(true);
    const bad = approvals.requestApprovalInput.safeParse({
      type: "refund.issue",
      subject: { type: "refund", id: U1 },
      payload: { orderId: U1 },
    });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues.some((i) => i.path[0] === "payload")).toBe(true);
  });

  it("decision inputs (API-ADM-02/03) and status machine", () => {
    expect(approvals.approveRequestInput.safeParse({ approvalRequestId: U1 }).success).toBe(true);
    expect(approvals.rejectRequestInput.safeParse({ approvalRequestId: U1 }).success).toBe(false);
    expect(
      approvals.rejectRequestInput.safeParse({ approvalRequestId: U1, comment: "no" }).success,
    ).toBe(true);
    expect(approvals.APPROVAL_STATUS_TRANSITIONS.approved).toEqual(["applied"]);
    expect(approvals.APPROVAL_STATUS_TRANSITIONS.applied).toEqual([]);
  });

  it("ApplyHandler registry is typed per approval type", () => {
    type PayoutHandler = Parameters<approvals.ApplyHandlerRegistry["registerApplyHandler"]>;
    expectTypeOf<PayoutHandler[0]>().toEqualTypeOf<approvals.ApprovalType>();
    const handler: approvals.ApplyHandler<approvals.ApprovalPayloadMap["payout.record"]> = async (
      _ctx,
      payload,
    ) => {
      expectTypeOf(payload.amountMinor).toEqualTypeOf<number>();
      expectTypeOf(payload.paidOn).toEqualTypeOf<string>();
    };
    expect(typeof handler).toBe("function");
    expectTypeOf<Parameters<approvals.ApprovalsService["decide"]>>().toEqualTypeOf<
      [string, string, "approve" | "reject", string | undefined, TxCtx]
    >();
  });
});

// ---------------------------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------------------------

describe("audit", () => {
  it("AuditEntry is assignable to the P1 AuditEvent port and log() has the §5 signature", () => {
    expectTypeOf<audit.AuditEntry>().toMatchTypeOf<AuditEvent>();
    expectTypeOf<Parameters<audit.AuditService["log"]>>().toEqualTypeOf<
      [audit.AuditActor, string, audit.AuditSubject, unknown, unknown, TxCtx]
    >();
    expect(audit.AUDIT_CONTRACT_METHODS).toEqual(["log"]);
  });

  it("action format accepts API ids with dotted verbs and hook events", () => {
    expect(audit.zAuditAction.safeParse("API-CAT-03 product.update").success).toBe(true);
    expect(audit.zAuditAction.safeParse("auth.sign_in").success).toBe(true);
    expect(audit.zAuditAction.safeParse("update").success).toBe(false);
    expect(audit.zAuditAction.safeParse("API-CAT-03 Product.Update").success).toBe(false);
  });

  it("auditEntryFromActor maps request contexts and system actors", () => {
    const ctx = buildContext({
      user: { id: U1 },
      session: { id: "s" },
      roles: ["admin"],
      ip: "1.2.3.4",
      userAgent: "ua",
      requestId: "req-1",
    });
    expect(
      audit.auditEntryFromActor(
        ctx,
        "API-PAY-03 payment.confirm",
        { type: "payment", id: U2 },
        { status: "submitted" },
        { status: "confirmed" },
      ),
    ).toEqual({
      action: "API-PAY-03 payment.confirm",
      actorId: U1,
      actorRole: "admin",
      subjectType: "payment",
      subjectId: U2,
      before: { status: "submitted" },
      after: { status: "confirmed" },
      ip: "1.2.3.4",
      userAgent: "ua",
      requestId: "req-1",
    });
    const anon = audit.auditEntryFromActor(
      anonymousContext({ requestId: "r2" }),
      "auth.sign_in",
      { type: "user", id: U1 },
      null,
      null,
    );
    expect(anon.actorId).toBeNull();
    expect(anon.requestId).toBe("r2");
    const sys = audit.auditEntryFromActor(
      { kind: "system", name: "cron:orders.expire" },
      "cron.orders.expire",
      { type: "order", id: U3 },
      null,
      { status: "failed" },
    );
    expect(sys).toMatchObject({
      actorId: null,
      actorRole: "cron:orders.expire",
      ip: null,
      requestId: null,
    });
    expect(audit.isSystemActor(sys as never)).toBe(false);
  });

  it("listAuditLogs / exportAuditLogs inputs (API-ADM-05)", () => {
    expect(
      audit.listAuditLogsInput.safeParse({
        filters: { action: "API-PAY", dateFrom: "2026-09-01" },
        sort: "createdAt:desc",
      }).success,
    ).toBe(true);
    expect(audit.listAuditLogsInput.safeParse({ filters: { actorId: "nope" } }).success).toBe(
      false,
    );
    expect(
      audit.exportAuditLogsInput.safeParse({ filters: { subjectType: "order" } }).success,
    ).toBe(true);
  });
});
