/**
 * Audit CSV exporter (docs/06 §2.7, API-ADM-05, PHASE-03 P3.1).
 * Formats audit log rows into RFC 4180 compliant CSV.
 */
import type { AuditLogRow } from "./types";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const AUDIT_CSV_HEADERS = [
  "id",
  "actor_id",
  "actor_role",
  "action",
  "subject_type",
  "subject_id",
  "before",
  "after",
  "ip",
  "user_agent",
  "request_id",
  "created_at",
] as const;

export function formatAuditLogsCsv(rows: readonly AuditLogRow[]): string {
  const lines: string[] = [AUDIT_CSV_HEADERS.join(",")];

  for (const row of rows) {
    const fields = [
      escapeCsvField(row.id),
      escapeCsvField(row.actorId),
      escapeCsvField(row.actorRole),
      escapeCsvField(row.action),
      escapeCsvField(row.subject.type),
      escapeCsvField(row.subject.id),
      escapeCsvField(row.before),
      escapeCsvField(row.after),
      escapeCsvField(row.ip),
      escapeCsvField(row.userAgent),
      escapeCsvField(row.requestId),
      escapeCsvField(row.createdAt),
    ];
    lines.push(fields.join(","));
  }

  return lines.join("\n");
}
