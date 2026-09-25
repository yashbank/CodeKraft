/**
 * Delivery tasks — docs/06 §2.5 API-DEL-07 `completeProvisioning`, DEL-08 `setLicenseKey`,
 * DEL-09 `markServiceStep`, DEL-10 `listDeliveryTasks` / `completeDeliveryTask`
 * (`modules/delivery`, caller `delivery.tasks.write`, admin scope: own products).
 */
import { z } from "zod";
import {
  isoDateTime,
  listParams,
  provisioningNotesSchema,
  uuid,
} from "@/modules/entitlements/types";

export const DELIVERY_TASK_KINDS = ["provision", "revoke_external"] as const;
export type DeliveryTaskKind = (typeof DELIVERY_TASK_KINDS)[number];
export const DELIVERY_TASK_STATUSES = ["open", "done"] as const;
export type DeliveryTaskStatus = (typeof DELIVERY_TASK_STATUSES)[number];

/**
 * API-DEL-07 `completeProvisioning` — `provisioning_state='done'`, `delivery_tasks(provision)`
 * done, `E: access-provisioned` (credentials only by email, D-601); order → `fulfilled` when
 * every entitlement is active and every checklist complete.
 */
export const completeProvisioningSchema = z
  .object({
    entitlementId: uuid,
    notes: provisioningNotesSchema,
    /** Send the credentials email now (`E: access-provisioned`). */
    credentialsEmail: z.boolean(),
  })
  .strict();
export type CompleteProvisioningInput = z.infer<typeof completeProvisioningSchema>;

/** Tiptap JSON document (validated against the allow-list by `_shared/zod.ts` `richText` in P3). */
const tiptapDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

/**
 * API-DEL-08 `setLicenseKey` — stored AES-GCM encrypted (`license_key_enc`); `E: license-key`
 * and `N: license.ready` carry only a dashboard link — never the key (D-603, MASTER_SPEC §7
 * "License key delivery"); order → `fulfilled`.
 */
export const setLicenseKeySchema = z
  .object({
    entitlementId: uuid,
    licenseKey: z.string().trim().min(8).max(512),
    installNotesJson: tiptapDocSchema.optional(),
    notifyEmail: z.boolean(),
  })
  .strict();
export type SetLicenseKeyInput = z.infer<typeof setLicenseKeySchema>;

/** API-DEL-09 `markServiceStep` — `service_progress`; all done → order `fulfilled` (D-608). */
export const markServiceStepSchema = z
  .object({
    entitlementId: uuid,
    stepKey: z.string().trim().min(1).max(80),
    done: z.boolean(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();
export type MarkServiceStepInput = z.infer<typeof markServiceStepSchema>;

/** API-DEL-10 `listDeliveryTasks`. */
export const listDeliveryTasksSchema = listParams(["createdAt", "status", "kind"], {
  kind: z.enum(DELIVERY_TASK_KINDS).optional(),
  status: z.enum(DELIVERY_TASK_STATUSES).optional(),
  /** `'me'` = the caller. */
  assignedTo: z.union([z.literal("me"), uuid]).optional(),
});
export type ListDeliveryTasksInput = z.infer<typeof listDeliveryTasksSchema>;

/** API-DEL-10 `completeDeliveryTask` — `revoke_external` completion also sets the entitlement `revoked`. */
export const completeDeliveryTaskSchema = z
  .object({ taskId: uuid, note: z.string().trim().max(2000).optional() })
  .strict();
export type CompleteDeliveryTaskInput = z.infer<typeof completeDeliveryTaskSchema>;

/** Assign/claim a task (SCR-ADM-12 "Assign to me"); not a numbered API row, part of DEL-10. */
export const assignDeliveryTaskSchema = z
  .object({ taskId: uuid, assignedTo: uuid.nullable() })
  .strict();
export type AssignDeliveryTaskInput = z.infer<typeof assignDeliveryTaskSchema>;

export interface DeliveryTaskRow {
  taskId: string;
  kind: DeliveryTaskKind;
  status: DeliveryTaskStatus;
  entitlementId: string;
  product: { id: string; name: string };
  customer: { id: string; email: string; name: string | null };
  assignedTo: { id: string; name: string | null } | null;
  note: string | null;
  createdAt: string;
  doneAt: string | null;
}

export interface MarkServiceStepResult {
  progress: Array<{ key: string; title: string; doneAt: string | null; note: string | null }>;
  /** `true` once every step is done (order marked `fulfilled` in the same transaction). */
  fulfilled: boolean;
}

export type { ProvisioningNotes } from "@/modules/entitlements/types";
export { isoDateTime };
