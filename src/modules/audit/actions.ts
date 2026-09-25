/**
 * `audit` Server Actions — API-ADM-05 `exportAuditLogs` (`audit.export`). The export writes a CSV
 * to the documents bucket and audits itself inside the same transaction (D-1104).
 */
import { defineAction } from "@/lib/actions/envelope";
import { auditService } from "./service";
import { exportAuditLogsInput } from "./types";

export const exportAuditLogs = defineAction({
  name: "API-ADM-05 audit.export",
  permission: "audit.export",
  input: exportAuditLogsInput,
  handler: (input, ctx) => auditService.exportAuditLogs(ctx, input),
});
