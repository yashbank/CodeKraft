/**
 * Delivery service contract — docs/06 §2.5 API-DEL-07..10 (`modules/delivery`), docs/04 §7.3,
 * D-601 (manual SaaS provisioning), D-603 (license key), D-607 (revocation task), D-608 (service
 * checklist), MASTER_SPEC §7 "Order fulfilled". Implementation in P5.
 */
import type { RequestContext } from "@/lib/authz/context";
import type { TxCtx } from "@/lib/db";
import type { ListResult } from "@/modules/_shared/zod";
import type { EntitlementAdminRow } from "@/modules/entitlements/types";
import type {
  AssignDeliveryTaskInput,
  CompleteDeliveryTaskInput,
  CompleteProvisioningInput,
  DeliveryTaskRow,
  ListDeliveryTasksInput,
  MarkServiceStepInput,
  MarkServiceStepResult,
  SetLicenseKeyInput,
} from "./types";

export type { DeliveryHandler, DeliveryHandlerRegistry } from "./handler";

export interface DeliveryService {
  /** API-DEL-07 `completeProvisioning` — `delivery.tasks.write`; `STATE_INVALID` unless `provisioning_state='pending'`. */
  completeProvisioning(
    ctx: RequestContext,
    input: CompleteProvisioningInput,
  ): Promise<EntitlementAdminRow>;

  /** API-DEL-08 `setLicenseKey` — encrypts and stores; notifications carry a dashboard link only. */
  setLicenseKey(ctx: RequestContext, input: SetLicenseKeyInput): Promise<EntitlementAdminRow>;

  /** API-DEL-09 `markServiceStep` — `NOT_FOUND` for an unknown `stepKey`; `N: service.progress` + `E: service-progress`. */
  markServiceStep(ctx: RequestContext, input: MarkServiceStepInput): Promise<MarkServiceStepResult>;

  /** API-DEL-10 `listDeliveryTasks` — `delivery.tasks.write` (admin scope: own products). */
  listDeliveryTasks(
    ctx: RequestContext,
    input: ListDeliveryTasksInput,
  ): Promise<ListResult<DeliveryTaskRow>>;

  /** API-DEL-10 `completeDeliveryTask` — `revoke_external` done → entitlement `revoked` if not already. */
  completeDeliveryTask(
    ctx: RequestContext,
    input: CompleteDeliveryTaskInput,
  ): Promise<DeliveryTaskRow>;

  /** Part of API-DEL-10: assign / claim / unassign a task. */
  assignDeliveryTask(ctx: RequestContext, input: AssignDeliveryTaskInput): Promise<DeliveryTaskRow>;

  /**
   * MASTER_SPEC §7 "Order fulfilled": re-evaluates one order inside the caller's transaction and
   * sets `orders.status='fulfilled', fulfilled_at` when every entitlement is `active` and every
   * service checklist is complete. Called after DEL-07/08/09 and by `grantForOrder`. Returns
   * `true` when the order transitioned in this call.
   */
  evaluateOrderFulfilment(orderId: string, tx: TxCtx): Promise<boolean>;
}
