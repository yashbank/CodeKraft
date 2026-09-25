/**
 * `audit` read models — API-ADM-05 `listAuditLogs` (`audit.read`); read-only, not itself audited
 * (MASTER_SPEC §4.9 exemption for list queries).
 */
import { defineAction } from "@/lib/actions/envelope";
import { auditService } from "./service";
import { listAuditLogsInput } from "./types";

export const listAuditLogs = defineAction({
  name: "API-ADM-05 audit.list",
  permission: "audit.read",
  input: listAuditLogsInput,
  handler: (input, ctx) => auditService.listAuditLogs(ctx, input),
});
