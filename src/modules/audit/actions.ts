"use server";

/**
 * Audit Server Actions (docs/06 §2.7, API-ADM-05; PHASE-03 P3.1).
 * Uses defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { exportAuditLogsInput } from "./types";
import { auditService } from "./service";

export const exportAuditLogsAction = defineAction({
  name: "API-ADM-05 audit.export",
  input: exportAuditLogsInput,
  permission: "audit.export",
  handler: (input, ctx) => auditService.exportAuditLogs(ctx, input),
});
