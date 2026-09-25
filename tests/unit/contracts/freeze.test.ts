/**
 * Cross-phase contract freeze (master plan §5, docs/06 §6 "What must never change", P2.8).
 *
 * Every signature P3–P6 build against is pinned here twice: at the type level with
 * `expectTypeOf` (a changed parameter list fails `tsc` and `vitest --typecheck`) and at runtime
 * where the contract has a value (method-name tuples, the `PAYMENT_PROVIDER_CONTRACT` fixture,
 * the permission list, the drizzle enums). Changing any of them needs an ADR.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { PERMISSIONS, isPermission } from "@/lib/authz/permissions";

import { FINANCE_POSTING_METHODS, type FinanceService } from "@/modules/finance/contracts";
import { ENTRY_TYPES } from "@/modules/finance/types";

import type { EntitlementsService, GrantedEntitlement } from "@/modules/entitlements/contracts";
import type { RevokeEntitlementResult } from "@/modules/entitlements/types";

import {
  APPROVALS_CONTRACT_METHODS,
  type ApplyContext,
  type ApplyHandler,
  type ApplyHandlerRegistry,
  type ApprovalsService,
  type RejectHandler,
} from "@/modules/approvals/contracts";
import {
  APPROVAL_TYPES,
  type ApprovalDecisionKind,
  type ApprovalPayloadMap,
  type ApprovalSubject,
  type ApprovalType,
  approvalPayloadSchemas,
} from "@/modules/approvals/types";

import type { EmitOptions, NotificationsService } from "@/modules/notifications/contracts";
import type {
  EmitResult,
  NotificationChannelName,
  NotificationPayload,
  NotificationTarget,
  NotificationType,
} from "@/modules/notifications/types";

import { AUDIT_CONTRACT_METHODS, type AuditService } from "@/modules/audit/contracts";
import type { AuditAction, AuditActor, AuditSubject } from "@/modules/audit/types";

import {
  PAYMENT_PROVIDER_CONTRACT,
  type ConfirmInput,
  type CreateIntentResult,
  type OrderForPayment,
  type PaymentMethodKey,
  type PaymentProvider,
  type PaymentResult,
  type PaymentRow,
  type RefundResult,
  type WebhookOutcome,
} from "@/modules/payments/provider";

import {
  createDeliveryHandlerRegistry,
  type CustomerDeliveryView,
  type CustomerViewSource,
  type DeliveryHandler,
  type DeliveryHandlerContext,
  type GrantOutcome,
  type RevocationInput,
  type RevokeOutcome,
} from "@/modules/delivery/handler";
import type { DeliveryType, EntitlementAdminAction } from "@/modules/entitlements/types";
import type { DeliveryTask, Entitlement, ServiceProgress } from "../../../drizzle/schema/delivery";

import {
  CAPTURE_LEAD_TOOL,
  LLM_STOP_REASONS,
  type LLMEvent,
  type LLMMessage,
  type LLMProvider,
  type LLMStreamOptions,
} from "@/modules/chat/llm";

import { WIDGET_CATALOG } from "@/modules/dashboard-widgets/types";
import { ORDER_STATUSES } from "@/modules/orders/types";

import { approvalType as approvalTypeEnum } from "../../../drizzle/schema/approvals";
import { orderStatus as orderStatusEnum } from "../../../drizzle/schema/commerce";
import { entryType as entryTypeEnum } from "../../../drizzle/schema/finance";

/** A transaction handle for runtime calls; the stubs never touch it. */
const tx = {} as TxCtx;

/** Parameter names of a (non-destructured, non-default) function, from its source text. */
function paramNames(fn: (...args: never[]) => unknown): string[] {
  const src = fn.toString();
  const open = src.indexOf("(");
  const close = src.indexOf(")", open);
  return src
    .slice(open + 1, close)
    .split(",")
    .map((p) => p.trim().replace(/[?:].*$/, ""))
    .filter((p) => p !== "");
}

// ---------------------------------------------------------------------------------------------
// finance.post*(id, tx)
// ---------------------------------------------------------------------------------------------

describe("finance posting contract (master plan §5)", () => {
  it("names exactly the five posting methods", () => {
    expect([...FINANCE_POSTING_METHODS]).toEqual([
      "postOrderPaid",
      "postRefund",
      "postPayout",
      "postExpense",
      "postAdjustment",
    ]);
  });

  it("every posting method is (id, tx) → Promise", () => {
    expectTypeOf<Parameters<FinanceService["postOrderPaid"]>>().toEqualTypeOf<[string, TxCtx]>();
    expectTypeOf<Parameters<FinanceService["postRefund"]>>().toEqualTypeOf<[string, TxCtx]>();
    expectTypeOf<Parameters<FinanceService["postPayout"]>>().toEqualTypeOf<[string, TxCtx]>();
    expectTypeOf<Parameters<FinanceService["postExpense"]>>().toEqualTypeOf<[string, TxCtx]>();
    expectTypeOf<Parameters<FinanceService["postAdjustment"]>>().toEqualTypeOf<[string, TxCtx]>();
    expectTypeOf<ReturnType<FinanceService["postOrderPaid"]>>().resolves.toHaveProperty(
      "allocationIds",
    );
    expectTypeOf<ReturnType<FinanceService["postRefund"]>>().resolves.toHaveProperty("entryIds");
  });

  it("ENTRY_TYPES equals the drizzle `entry_type` enum, in order", () => {
    expect([...ENTRY_TYPES]).toEqual([...entryTypeEnum.enumValues]);
  });
});

// ---------------------------------------------------------------------------------------------
// entitlements.grantForOrder(orderId, tx) / revoke(entitlementId, reason, tx)
// ---------------------------------------------------------------------------------------------

describe("entitlements contract (master plan §5)", () => {
  it("grantForOrder(orderId, tx) → Promise<GrantedEntitlement[]>", () => {
    expectTypeOf<Parameters<EntitlementsService["grantForOrder"]>>().toEqualTypeOf<
      [string, TxCtx]
    >();
    expectTypeOf<ReturnType<EntitlementsService["grantForOrder"]>>().toEqualTypeOf<
      Promise<GrantedEntitlement[]>
    >();
    expectTypeOf<GrantedEntitlement>().toHaveProperty("entitlementId");
    expectTypeOf<GrantedEntitlement>().toHaveProperty("orderItemId");
    expectTypeOf<GrantedEntitlement>().toHaveProperty("taskIds");
  });

  it("revoke(entitlementId, reason, tx) → Promise<RevokeEntitlementResult>", () => {
    expectTypeOf<Parameters<EntitlementsService["revoke"]>>().toEqualTypeOf<
      [string, string, TxCtx]
    >();
    expectTypeOf<ReturnType<EntitlementsService["revoke"]>>().toEqualTypeOf<
      Promise<RevokeEntitlementResult>
    >();
  });

  it("the P2.8 skeleton rejects both with INTERNAL", async () => {
    await expect(svc.grantForOrder("o", tx)).rejects.toMatchObject({
      code: ErrorCode.INTERNAL,
      message: "entitlements.grantForOrder not implemented (P5)",
    });
    await expect(svc.revoke("e", "refund", tx)).rejects.toMatchObject({
      code: ErrorCode.INTERNAL,
      message: "entitlements.revoke not implemented (P5)",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// approvals.request / decide / execute + apply-handler registry
// ---------------------------------------------------------------------------------------------

describe("approvals contract (master plan §5)", () => {
  it("names the frozen methods", () => {
    expect([...APPROVALS_CONTRACT_METHODS]).toEqual([
      "request",
      "decide",
      "execute",
      "registerApplyHandler",
      "registerRejectHandler",
    ]);
  });

  it("request(type, subject, payload, requesterId, tx)", () => {
    type P = Parameters<ApprovalsService["request"]>;
    expectTypeOf<P["length"]>().toEqualTypeOf<5>();
    expectTypeOf<P[0]>().toEqualTypeOf<ApprovalType>();
    expectTypeOf<P[1]>().toEqualTypeOf<ApprovalSubject>();
    expectTypeOf<P[2]>().toEqualTypeOf<ApprovalPayloadMap[ApprovalType]>();
    expectTypeOf<P[3]>().toEqualTypeOf<string>();
    expectTypeOf<P[4]>().toEqualTypeOf<TxCtx>();
    expectTypeOf<ReturnType<ApprovalsService["request"]>>().toEqualTypeOf<
      Promise<{ approvalRequestId: string }>
    >();
  });

  it("decide(requestId, adminId, decision, comment?, tx) and execute(requestId, tx)", () => {
    expectTypeOf<Parameters<ApprovalsService["decide"]>>().toEqualTypeOf<
      [string, string, ApprovalDecisionKind, string | undefined, TxCtx]
    >();
    expectTypeOf<Parameters<ApprovalsService["execute"]>>().toEqualTypeOf<[string, TxCtx]>();
    expectTypeOf<ApprovalDecisionKind>().toEqualTypeOf<"approve" | "reject">();
  });

  it("apply-handler registry: register/get per type, handler(ctx, payload, tx)", () => {
    expectTypeOf<ApprovalsService>().toExtend<ApplyHandlerRegistry>();
    expectTypeOf<ApplyHandlerRegistry>().toHaveProperty("registerApplyHandler");
    expectTypeOf<ApplyHandlerRegistry>().toHaveProperty("registerRejectHandler");
    expectTypeOf<ApplyHandlerRegistry>().toHaveProperty("getApplyHandler");
    expectTypeOf<ApplyHandlerRegistry>().toHaveProperty("getRejectHandler");
    expectTypeOf<Parameters<ApplyHandler<{ a: 1 }>>>().toEqualTypeOf<
      [ApplyContext, { a: 1 }, TxCtx]
    >();
    expectTypeOf<Parameters<RejectHandler<{ a: 1 }>>>().toEqualTypeOf<
      [ApplyContext, { a: 1 }, TxCtx]
    >();
    expectTypeOf<ApplyContext>().toEqualTypeOf<{
      requestId: string;
      type: ApprovalType;
      subject: ApprovalSubject;
      requestedBy: string;
      decidedBy: string;
    }>();
    // A handler registered for one type is typed against that type's payload only.
    expectTypeOf<Parameters<ApplyHandler<ApprovalPayloadMap["payout.record"]>>[1]>().toEqualTypeOf<
      ApprovalPayloadMap["payout.record"]
    >();
  });

  it("every approval type has a Zod payload schema and mirrors the drizzle enum", () => {
    expect([...APPROVAL_TYPES]).toEqual([...approvalTypeEnum.enumValues]);
    expect(Object.keys(approvalPayloadSchemas).sort()).toEqual([...APPROVAL_TYPES].sort());
    for (const type of APPROVAL_TYPES) {
      expect(approvalPayloadSchemas[type]).toBeInstanceOf(z.ZodType);
      // strict: an arbitrary object never parses (every payload requires at least one key)
      expect(approvalPayloadSchemas[type].safeParse({ unexpected: true }).success).toBe(false);
    }
  });

  it("the P2.8 skeleton throws INTERNAL for the registry and rejects for request/decide/execute", async () => {
    expect(() => svc.registerApplyHandler("payout.record", async () => undefined)).toThrow(
      "approvals.registerApplyHandler not implemented (P3)",
    );
    await expect(svc.execute("r", tx)).rejects.toMatchObject({ code: ErrorCode.INTERNAL });
  });
});

// ---------------------------------------------------------------------------------------------
// notifications.emit(userId | 'admins', type, payload, channels, tx)
// ---------------------------------------------------------------------------------------------

describe("notifications.emit contract (master plan §5)", () => {
  it("emit(target, type, payload, channels | undefined, tx, options?)", () => {
    type P = Parameters<NotificationsService["emit"]>;
    expectTypeOf<P["length"]>().toEqualTypeOf<5 | 6>();
    expectTypeOf<P[0]>().toEqualTypeOf<NotificationTarget>();
    expectTypeOf<P[1]>().toEqualTypeOf<NotificationType>();
    expectTypeOf<P[2]>().toEqualTypeOf<NotificationPayload>();
    expectTypeOf<P[3]>().toEqualTypeOf<readonly NotificationChannelName[] | undefined>();
    expectTypeOf<P[4]>().toEqualTypeOf<TxCtx>();
    expectTypeOf<P[5]>().toEqualTypeOf<EmitOptions | undefined>();
    expectTypeOf<ReturnType<NotificationsService["emit"]>>().toEqualTypeOf<Promise<EmitResult>>();
  });

  it("target accepts a user id and the 'admins' broadcast", () => {
    expectTypeOf<"admins">().toExtend<NotificationTarget>();
    expectTypeOf<string>().toExtend<NotificationTarget>();
  });

  it("the P2.8 skeleton rejects emit with INTERNAL", async () => {
    await expect(
      svc.emit(
        "admins",
        "approval.requested" as NotificationType,
        {} as NotificationPayload,
        undefined,
        tx,
      ),
    ).rejects.toMatchObject({ message: "notifications.emit not implemented (P6)" });
  });
});

// ---------------------------------------------------------------------------------------------
// audit.log(actor, action, subject, before, after, tx)
// ---------------------------------------------------------------------------------------------

describe("audit.log contract (master plan §5)", () => {
  it("log(actor, action, subject, before, after, tx) → Promise<{ auditLogId }>", () => {
    expect([...AUDIT_CONTRACT_METHODS]).toEqual(["log"]);
    expectTypeOf<Parameters<AuditService["log"]>>().toEqualTypeOf<
      [AuditActor, AuditAction, AuditSubject, unknown, unknown, TxCtx]
    >();
    expectTypeOf<ReturnType<AuditService["log"]>>().toEqualTypeOf<
      Promise<{ auditLogId: string }>
    >();
  });

  it("the P2.8 skeleton rejects log with INTERNAL", async () => {
    await expect(
      svc.log(
        { kind: "system", name: "system" } satisfies AuditActor,
        "x.y" as AuditAction,
        { type: "t", id: "i" },
        null,
        null,
        tx,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL,
      message: "audit.log not implemented (P3)",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// PaymentProvider — docs/04 §7.1 / docs/06 §4.1, PAYMENT_PROVIDER_CONTRACT fixture
// ---------------------------------------------------------------------------------------------

describe("PaymentProvider contract (docs/06 §4.1)", () => {
  /** A compile-time-checked fake whose parameter names are the docs/06 names. */
  const fake: Required<PaymentProvider> = {
    keys: ["manual_upi", "manual_bank"],
    async createIntent(ctx, order, method) {
      void ctx;
      void order;
      void method;
      return {} as CreateIntentResult;
    },
    async confirm(ctx, payment, input) {
      void ctx;
      void payment;
      void input;
      return {} as PaymentResult;
    },
    async refund(ctx, payment, amountMinor, reason) {
      void ctx;
      void payment;
      void amountMinor;
      void reason;
      return {} as RefundResult;
    },
    async handleWebhook(req) {
      void req;
      return {} as WebhookOutcome;
    },
  };

  it("member set equals the fixture keys", () => {
    expect(Object.keys(PAYMENT_PROVIDER_CONTRACT).sort()).toEqual(
      ["keys", "createIntent", "confirm", "refund", "handleWebhook"].sort(),
    );
    expectTypeOf<keyof PaymentProvider>().toEqualTypeOf<keyof typeof PAYMENT_PROVIDER_CONTRACT>();
    expect(Object.keys(fake).sort()).toEqual(Object.keys(PAYMENT_PROVIDER_CONTRACT).sort());
  });

  it("parameter names and arity match the fixture", () => {
    expect(paramNames(fake.createIntent)).toEqual([...PAYMENT_PROVIDER_CONTRACT.createIntent]);
    expect(paramNames(fake.confirm)).toEqual([...PAYMENT_PROVIDER_CONTRACT.confirm]);
    expect(paramNames(fake.refund)).toEqual([...PAYMENT_PROVIDER_CONTRACT.refund]);
    expect(paramNames(fake.handleWebhook)).toEqual([...PAYMENT_PROVIDER_CONTRACT.handleWebhook]);
    expectTypeOf<Parameters<PaymentProvider["createIntent"]>>().toEqualTypeOf<
      [TxCtx, OrderForPayment, PaymentMethodKey]
    >();
    expectTypeOf<Parameters<PaymentProvider["confirm"]>>().toEqualTypeOf<
      [TxCtx, PaymentRow, ConfirmInput]
    >();
    expectTypeOf<Parameters<NonNullable<PaymentProvider["refund"]>>>().toEqualTypeOf<
      [TxCtx, PaymentRow, number, string]
    >();
    expectTypeOf<Parameters<NonNullable<PaymentProvider["handleWebhook"]>>>().toEqualTypeOf<
      [Request]
    >();
  });

  it("confirm returns the four amounts and never a ledger handle", () => {
    expectTypeOf<PaymentResult>().toHaveProperty("amountReceivedMinor");
    expectTypeOf<PaymentResult>().toHaveProperty("gatewayFeeMinor");
    expectTypeOf<PaymentResult>().toHaveProperty("bankShortfallMinor");
    expectTypeOf<PaymentResult>().toHaveProperty("customerCreditMinor");
    expectTypeOf<PaymentResult>().not.toHaveProperty("ledgerEntryIds");
    expectTypeOf<PaymentProvider["keys"]>().toEqualTypeOf<PaymentMethodKey[]>();
  });
});

// ---------------------------------------------------------------------------------------------
// DeliveryHandler — docs/04 §7.3
// ---------------------------------------------------------------------------------------------

describe("DeliveryHandler contract (docs/04 §7.3)", () => {
  const fake: DeliveryHandler<"download"> = {
    type: "download",
    async onGranted(ctx, entitlement, tx) {
      void ctx;
      void entitlement;
      void tx;
      return {} as GrantOutcome;
    },
    async onRevoked(ctx, entitlement, revocation, tx) {
      void ctx;
      void entitlement;
      void revocation;
      void tx;
      return {} as RevokeOutcome;
    },
    customerView: (source) => ({ type: "download", downloads: source as never }),
    adminActions: () => [],
    isFulfilled: () => true,
  };

  it("has exactly type/onGranted/onRevoked/customerView/adminActions/isFulfilled", () => {
    expectTypeOf<keyof DeliveryHandler>().toEqualTypeOf<
      "type" | "onGranted" | "onRevoked" | "customerView" | "adminActions" | "isFulfilled"
    >();
    expect(Object.keys(fake).sort()).toEqual(
      ["type", "onGranted", "onRevoked", "customerView", "adminActions", "isFulfilled"].sort(),
    );
    expect(paramNames(fake.onGranted)).toEqual(["ctx", "entitlement", "tx"]);
    expect(paramNames(fake.onRevoked)).toEqual(["ctx", "entitlement", "revocation", "tx"]);
  });

  it("lifecycle signatures are frozen", () => {
    expectTypeOf<Parameters<DeliveryHandler["onGranted"]>>().toEqualTypeOf<
      [DeliveryHandlerContext, Entitlement, TxCtx]
    >();
    expectTypeOf<ReturnType<DeliveryHandler["onGranted"]>>().toEqualTypeOf<Promise<GrantOutcome>>();
    expectTypeOf<Parameters<DeliveryHandler["onRevoked"]>>().toEqualTypeOf<
      [DeliveryHandlerContext, Entitlement, RevocationInput, TxCtx]
    >();
    expectTypeOf<ReturnType<DeliveryHandler["onRevoked"]>>().toEqualTypeOf<
      Promise<RevokeOutcome>
    >();
    expectTypeOf<Parameters<DeliveryHandler["customerView"]>>().toEqualTypeOf<
      [CustomerViewSource]
    >();
    expectTypeOf<
      ReturnType<DeliveryHandler["customerView"]>
    >().toEqualTypeOf<CustomerDeliveryView>();
    expectTypeOf<Parameters<DeliveryHandler["adminActions"]>>().toEqualTypeOf<
      [Entitlement, DeliveryTask[]]
    >();
    expectTypeOf<ReturnType<DeliveryHandler["adminActions"]>>().toEqualTypeOf<
      EntitlementAdminAction[]
    >();
    expectTypeOf<Parameters<DeliveryHandler["isFulfilled"]>>().toEqualTypeOf<
      [Entitlement, ServiceProgress[]]
    >();
    expectTypeOf<ReturnType<DeliveryHandler["isFulfilled"]>>().toEqualTypeOf<boolean>();
    expectTypeOf<RevocationInput["mode"]>().toEqualTypeOf<"hard" | "soft">();
    expectTypeOf<DeliveryHandler["type"]>().toEqualTypeOf<DeliveryType>();
  });

  it("the registry registers once per type and throws RangeError for unknown types", () => {
    const registry = createDeliveryHandlerRegistry();
    expect(registry.has("download")).toBe(false);
    registry.register(fake);
    expect(registry.has("download")).toBe(true);
    expect(registry.types()).toEqual(["download"]);
    expect(registry.get("download")).toBe(fake);
    expect(() => registry.register(fake)).toThrow(RangeError);
    expect(() => registry.get("saas")).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------------------------
// LLMProvider — docs/04 §9
// ---------------------------------------------------------------------------------------------

describe("LLMProvider contract (docs/04 §9)", () => {
  it("stream(system, messages, opts) → AsyncIterable<LLMEvent>; readonly id/model", () => {
    expectTypeOf<keyof LLMProvider>().toEqualTypeOf<"id" | "model" | "stream">();
    expectTypeOf<Parameters<LLMProvider["stream"]>>().toEqualTypeOf<
      [string, readonly LLMMessage[], LLMStreamOptions]
    >();
    expectTypeOf<ReturnType<LLMProvider["stream"]>>().toEqualTypeOf<AsyncIterable<LLMEvent>>();
    expectTypeOf<LLMProvider["id"]>().toEqualTypeOf<string>();
    expectTypeOf<LLMProvider["model"]>().toEqualTypeOf<string>();
    expectTypeOf<LLMStreamOptions>().toHaveProperty("maxTokens");
    expectTypeOf<LLMStreamOptions>().toHaveProperty("timeoutMs");
    expectTypeOf<LLMEvent["type"]>().toEqualTypeOf<"text" | "tool" | "refusal" | "done">();
  });

  it("stop reasons and the single capture_lead tool are frozen", () => {
    expect([...LLM_STOP_REASONS]).toEqual([
      "end_turn",
      "max_tokens",
      "tool_use",
      "refusal",
      "timeout",
      "error",
    ]);
    expect(CAPTURE_LEAD_TOOL.name).toBe("capture_lead");
    expect(CAPTURE_LEAD_TOOL.inputSchema).toMatchObject({
      type: "object",
      required: ["need"],
      additionalProperties: false,
    });
    expect(Object.isFrozen(CAPTURE_LEAD_TOOL)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Permission strings (docs/06 §1.2) and the widget catalog
// ---------------------------------------------------------------------------------------------

describe("permission string list (docs/06 §1.2)", () => {
  it("has exactly 51 unique entries", () => {
    expect(PERMISSIONS).toHaveLength(51);
    expect(new Set(PERMISSIONS).size).toBe(51);
    expectTypeOf<(typeof PERMISSIONS)["length"]>().toEqualTypeOf<51>();
  });

  it("every dashboard widget requires a known permission", () => {
    const widgets = Object.values(WIDGET_CATALOG);
    expect(widgets.length).toBeGreaterThan(0);
    for (const widget of widgets) {
      expect(isPermission(widget.requiredPermission), widget.key).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Enums mirrored from drizzle
// ---------------------------------------------------------------------------------------------

describe("enum mirrors equal the drizzle enums", () => {
  it("order statuses", () => {
    expect([...ORDER_STATUSES]).toEqual([...orderStatusEnum.enumValues]);
  });
});

// ---------------------------------------------------------------------------------------------
// Every module's NotImplemented skeleton satisfies its contract and fails loudly
// ---------------------------------------------------------------------------------------------
