/**
 * Ports shared by the `entitlements` and `delivery` services (PHASE-05 P5.1–P5.4).
 *
 * Both services are built with `create<X>Service(deps)`; the singletons resolve their ports
 * lazily through `resolveDeliveryPorts()` so the integrator (bootstrap) can wire the real
 * audit / notifications / subscriptions / storage implementations with `configureDeliveryPorts`
 * once those modules land — nothing here connects to the database or parses env at import time.
 *
 * Defaults (each replaceable):
 *  - `db`            the pooled app client (`src/lib/db`)
 *  - `audit`         inserts `audit_logs` rows inside the caller's transaction (MASTER_SPEC §4.9)
 *  - `notifications` logs a warning and delivers nothing until `NotificationsService` (P6) is wired
 *  - `emails`        `sendEmail` from `src/lib/email/transport` (log/outbox/resend by env)
 *  - `subscriptions` inserts the `subscriptions` row on grant; renewal roll-forward rejects until P5.6 wires it
 *  - `presigner`     SigV4 presign against R2/MinIO from env (`modules/delivery/downloads`)
 *  - `handlers`      the six delivery handlers (`modules/delivery/handlers`)
 */
import { addMonths } from "@/lib/dates";
import { type Db, type TxCtx, db as appDb } from "@/lib/db";
import { sendEmail } from "@/lib/email/transport";
import type { EmailTemplate } from "@/lib/email/types";
import { getEnv } from "@/lib/env";
import { getLogger } from "@/lib/logger";
import { HOUR_MS, assertRateLimit } from "@/lib/rate-limit";
import type { AuditService } from "@/modules/audit/contracts";
import { auditEntryFromActor } from "@/modules/audit/types";
import { auditLogs } from "../../../drizzle/schema/audit";
import { type Subscription, subscriptions } from "../../../drizzle/schema/delivery";
import type { TiptapDoc } from "../../../drizzle/schema/catalog";
import type { DeliveryHandlerRegistry } from "@/modules/delivery/handler";
import { defaultDeliveryHandlerRegistry } from "@/modules/delivery/handlers";
import {
  type DownloadPresigner,
  createS3DownloadPresigner,
  s3ConfigFromEnv,
} from "@/modules/delivery/downloads";
import type { NotificationsService } from "@/modules/notifications/contracts";
import { createNotImplementedSubscriptionsService } from "@/modules/subscriptions/service";
import type { BillingInterval } from "@/modules/subscriptions/types";
import { renderInstructionsHtml } from "./rich-text";

/** docs/06 `E:` column names; P1's `EmailTemplate` union is extended by the P6 outbox templates. */
export interface DeliveryEmail {
  to: string;
  template: string;
  subject: string;
  data: Record<string, unknown>;
}

export interface EmailPort {
  /** Best effort, never throws into the domain transaction (failures are logged). */
  enqueue(message: DeliveryEmail): Promise<void>;
}

export interface CreateSubscriptionInput {
  entitlementId: string;
  interval: BillingInterval;
  periodStart: Date;
  /** Explicit end (manual grants with `accessMonths`); default `periodStart + interval`. */
  periodEnd?: Date | null;
}

/** The slice of P5.6 the grant path needs (`SubscriptionsService` has no create method by contract). */
export interface SubscriptionsPort {
  createForEntitlement(input: CreateSubscriptionInput, tx: TxCtx): Promise<Subscription>;
  /** `SubscriptionsService.onRenewalPaid` — renewal orders never create a second entitlement. */
  onRenewalPaid(orderId: string, tx: TxCtx): Promise<unknown>;
}

export type RateLimiter = (key: string, limit: number, windowMs: number) => Promise<void>;

export interface DeliveryPorts {
  db: Db;
  audit: Pick<AuditService, "log">;
  notifications: Pick<NotificationsService, "emit">;
  emails: EmailPort;
  subscriptions: SubscriptionsPort;
  presigner: DownloadPresigner;
  handlers: DeliveryHandlerRegistry;
  renderRichText: (doc: TiptapDoc | null | undefined) => string | null;
  rateLimit: RateLimiter;
  siteUrl: () => string;
  now: () => Date;
}

export const INTERVAL_MONTHS: Readonly<Record<BillingInterval, number>> = Object.freeze({
  monthly: 1,
  quarterly: 3,
  annual: 12,
});

/** Default audit writer: one `audit_logs` row inside `tx` (the P3 `AuditService` replaces it). */
export function createDrizzleAuditPort(): Pick<AuditService, "log"> {
  return {
    async log(actor, action, subject, before, after, tx) {
      const entry = auditEntryFromActor(actor, action, subject, before, after);
      const [row] = await tx
        .insert(auditLogs)
        .values({
          actorId: entry.actorId,
          actorRole: entry.actorRole,
          action: entry.action,
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          before: entry.before ?? null,
          after: entry.after ?? null,
          ip: entry.ip,
          userAgent: entry.userAgent,
          requestId: entry.requestId,
        })
        .returning({ id: auditLogs.id });
      if (row === undefined) throw new Error("audit_logs insert returned no row");
      return { auditLogId: row.id };
    },
  };
}

/** Until P6 wires `NotificationsService`: log and deliver nothing (never blocks a domain write). */
export function createUnwiredNotificationsPort(): Pick<NotificationsService, "emit"> {
  return {
    emit(target, type) {
      getLogger().warn(
        { target, type },
        "notifications port not wired: entitlements/delivery notification dropped",
      );
      return Promise.resolve({ notificationIds: [], recipients: [], emailOutboxIds: [] });
    },
  };
}

export function createTransportEmailPort(): EmailPort {
  return {
    async enqueue(message) {
      try {
        await sendEmail({
          to: message.to,
          subject: message.subject,
          // docs/06 `E:` names; the P6 outbox owns the template set (P1 union is a subset).
          template: message.template as EmailTemplate,
          data: message.data,
          priority: 5,
        });
      } catch (err) {
        getLogger().error({ err, template: message.template }, "delivery email enqueue failed");
      }
    },
  };
}

export function createDefaultSubscriptionsPort(): SubscriptionsPort {
  const skeleton = createNotImplementedSubscriptionsService();
  return {
    async createForEntitlement(input, tx) {
      const periodEnd = input.periodEnd ?? addMonths(input.periodStart, INTERVAL_MONTHS[input.interval]);
      const [row] = await tx
        .insert(subscriptions)
        .values({
          entitlementId: input.entitlementId,
          interval: input.interval,
          currentPeriodStart: input.periodStart,
          currentPeriodEnd: periodEnd,
          status: "active",
        })
        .returning();
      if (row === undefined) throw new Error("subscriptions insert returned no row");
      return row;
    },
    onRenewalPaid: (orderId, tx) => skeleton.onRenewalPaid(orderId, tx),
  };
}

export function createDefaultRateLimiter(): RateLimiter {
  return async (key, limit, windowMs) => {
    await assertRateLimit(key, limit, windowMs);
  };
}

/** docs/06 §1.7 classes used here. */
export const RATE_LIMITS = Object.freeze({
  download: { limit: 20, windowMs: HOUR_MS },
  keyReveal: { limit: 10, windowMs: HOUR_MS },
});

function defaultPorts(): DeliveryPorts {
  return {
    db: appDb,
    audit: createDrizzleAuditPort(),
    notifications: createUnwiredNotificationsPort(),
    emails: createTransportEmailPort(),
    subscriptions: createDefaultSubscriptionsPort(),
    presigner: createS3DownloadPresigner(s3ConfigFromEnv),
    handlers: defaultDeliveryHandlerRegistry(),
    renderRichText: renderInstructionsHtml,
    rateLimit: createDefaultRateLimiter(),
    siteUrl: () => getEnv().NEXT_PUBLIC_SITE_URL,
    now: () => new Date(),
  };
}

let overrides: Partial<DeliveryPorts> = {};
let resolved: DeliveryPorts | undefined;

/** Integrator hook: wire real ports (audit, notifications, subscriptions, media). Resets the singletons' cache. */
export function configureDeliveryPorts(next: Partial<DeliveryPorts>): void {
  overrides = { ...overrides, ...next };
  resolved = undefined;
}

/** Drop every override (tests). */
export function resetDeliveryPorts(): void {
  overrides = {};
  resolved = undefined;
}

export function resolveDeliveryPorts(): DeliveryPorts {
  resolved ??= { ...defaultPorts(), ...overrides };
  return resolved;
}

/** Build a service object whose methods resolve the real instance on first call (import-safe). */
export function lazyService<T extends object>(keys: readonly (keyof T)[], build: () => T): T {
  let instance: T | undefined;
  const get = (): T => (instance ??= build());
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key as string] = (...args: unknown[]) => {
      const target = get();
      const fn = target[key] as unknown as (...a: unknown[]) => unknown;
      return fn.apply(target, args);
    };
  }
  return out as T;
}

/** Dashboard entitlement page — the only place a license key is ever shown (TM-05). */
export function entitlementDashboardUrl(siteUrl: string, entitlementId: string): string {
  return `${siteUrl}/account/entitlements/${entitlementId}`;
}
