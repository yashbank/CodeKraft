"use server";

/**
 * Audit read queries (docs/06 §2.7, API-ADM-05; PHASE-03 P3.1).
 * Uses defineAction with audit.read permission.
 */
import { defineAction } from "@/lib/actions/envelope";
import { listAuditLogsInput } from "./types";
import { auditService } from "./service";

export const listAuditLogsAction = defineAction({
  name: "API-ADM-05 audit.list",
  input: listAuditLogsInput,
  permission: "audit.read",
  handler: (input, ctx) => auditService.listAuditLogs(ctx, input),
});
