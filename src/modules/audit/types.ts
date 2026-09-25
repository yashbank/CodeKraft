/**
 * Audit — row shape, actor model and API-ADM-05 inputs (docs/06 §1.6, §2.7; docs/05 T-audit_logs;
 * MASTER_SPEC §4.9, §7 "Audit atomicity"; D-1104). Aligned with `src/lib/audit-port.ts`
 * (`AuditEvent`): an `AuditEntry` is assignable to an `AuditEvent`, so P1 emitters keep working
 * once the P2.8 sink writes real rows.
 */
import { z } from "zod";
import type { AuditEvent } from "@/lib/audit-port";
import type { Context } from "@/lib/authz/context";
import type { AuditLog } from "../../../drizzle/schema/audit";
import { zDateRange, zListParams, zTrimmed, zUuid } from "@/modules/orders/types";

/**
 * `action` = API id + dotted verb for admin/customer actions (`API-CAT-03 product.update`), or a
 * dotted event name for hooks and jobs (`auth.sign_in`, `cron.orders.expire`).
 */
export const zAuditAction = z
  .string()
  .trim()
  .regex(/^(?:API-[A-Z]+-\d{2} )?[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/, "audit action");
export type AuditAction = z.infer<typeof zAuditAction>;

export const zAuditSubject = z.object({ type: zTrimmed(1, 60), id: zTrimmed(1, 120) }).strict();
export type AuditSubject = z.infer<typeof zAuditSubject>;

/** Non-user actors: jobs, webhooks, seed. `name` is stored as `actor_role` (e.g. `webhook:razorpay`). */
export interface SystemActor {
  kind: "system";
  name: `cron:${string}` | `webhook:${string}` | `seed` | `system`;
  requestId?: string;
}

/** Either the request context (user or anonymous) or a system actor. */
export type AuditActor = Context | SystemActor;

export function isSystemActor(actor: AuditActor): actor is SystemActor {
  return "kind" in actor && actor.kind === "system";
}

/** What `audit.log` writes — one `audit_logs` row, JSON diffs as given by the caller. */
export interface AuditEntry extends AuditEvent {
  action: AuditAction;
  actorId: string | null;
  actorRole: string | null;
  subjectType: string;
  subjectId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** Build the row fields from an actor (pure; used by the P2.8 minimal sink and by tests). */
export function auditEntryFromActor(
  actor: AuditActor,
  action: AuditAction,
  subject: AuditSubject,
  before: unknown,
  after: unknown,
): AuditEntry {
  if (isSystemActor(actor)) {
    return {
      action,
      actorId: null,
      actorRole: actor.name,
      subjectType: subject.type,
      subjectId: subject.id,
      before,
      after,
      ip: null,
      userAgent: null,
      requestId: actor.requestId ?? null,
    };
  }
  return {
    action,
    actorId: actor.userId,
    actorRole: actor.roles[0] ?? null,
    subjectType: subject.type,
    subjectId: subject.id,
    before,
    after,
    ip: actor.ip ?? null,
    userAgent: actor.userAgent ?? null,
    requestId: actor.requestId,
  };
}

// ---------------------------------------------------------------------------------------------
// API-ADM-05 listAuditLogs (query) / exportAuditLogs — `audit.read` / `audit.export`
// ---------------------------------------------------------------------------------------------

const auditFilters = z
  .object({
    actorId: zUuid.optional(),
    /** Prefix match, e.g. `API-PAY` or `auth.`. */
    action: zTrimmed(1, 120).optional(),
    subjectType: zTrimmed(1, 60).optional(),
    subjectId: zTrimmed(1, 120).optional(),
    ...zDateRange,
  })
  .strict();

export const listAuditLogsInput = zListParams(["createdAt"], auditFilters);
export type ListAuditLogsInput = z.infer<typeof listAuditLogsInput>;

export const exportAuditLogsInput = z
  .object({ filters: auditFilters.optional(), q: z.string().trim().max(200).optional() })
  .strict();
export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsInput>;

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  subject: AuditSubject;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface AuditExportResult {
  /** 5-minute presigned GET to the CSV (D-1104); the export itself is audited. */
  url: string;
  filename: string;
  expiresAt: string;
}

export type { AuditEvent, AuditLog };
