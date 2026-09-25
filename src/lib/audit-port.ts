/**
 * Audit port (docs/06 §1.6, D-1104). Auth and other P1 code emit events through this port;
 * P2/P3 plug in the `audit_logs` table writer. The default sink logs at info level so nothing is lost.
 */
import { getLogger } from "@/lib/logger";

export interface AuditEvent {
  action: string; // e.g. auth.sign_in, auth.session_replaced, auth.totp.enabled
  actorId?: string | null;
  actorRole?: string | null;
  subjectType?: string;
  subjectId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  meta?: Record<string, unknown>;
}

export type AuditSink = (event: AuditEvent) => Promise<void> | void;

let sink: AuditSink = (event) => {
  getLogger().info({ audit: event }, `audit ${event.action}`);
};

export function setAuditSink(next: AuditSink): void {
  sink = next;
}

/** Never throws: audit failures are logged, not surfaced (the domain transaction owns atomicity, MASTER_SPEC §7). */
export async function audit(event: AuditEvent): Promise<void> {
  try {
    await sink(event);
  } catch (err) {
    getLogger().error({ err, action: event.action }, "audit sink failed");
  }
}
