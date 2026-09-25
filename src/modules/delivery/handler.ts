/**
 * `DeliveryHandler` — the per-delivery-type strategy behind entitlements (docs/04 §7.3,
 * master plan §5, PHASE-02 P2.7). One handler per `delivery_type` lives in
 * `modules/delivery/handlers/<type>.ts` (P5); this file is the frozen interface.
 *
 * Lifecycle (docs/06 §5.1, §5.3, §5.7, D-601..D-608):
 *  - `onGranted`  — called by `entitlements.grantForOrder` / `grantManual` inside the caller's
 *                   transaction right after the `entitlements` row exists. Decides the initial
 *                   status / provisioning state and opens `delivery_tasks(provision)` when a
 *                   human must act (manual SaaS/hosted, D-601).
 *  - `onRevoked`  — `mode: 'hard'` for refund/admin revoke (row is `revoked`), `mode: 'soft'`
 *                   for subscription suspension (row is `suspended`, re-activation possible).
 *                   Automatic vs `delivery_tasks(revoke_external)` is the handler's call (D-607).
 *  - `customerView` — the per-type slice of API-DEL-01 `EntitlementView` (download files + cap,
 *                   masked license key, SaaS credentials/instructions, service checklist, custom).
 *  - `adminActions` — buttons for SCR-ADM-12; each names the API-DEL action it calls.
 *  - `isFulfilled` — feeds MASTER_SPEC §7 "Order fulfilled".
 */
import type { TxCtx } from "@/lib/db";
import type { DeliveryConfig, ServiceStep } from "../../../drizzle/schema/offerings";
import type {
  DeliveryTask,
  Entitlement,
  ServiceProgress,
  Subscription,
} from "../../../drizzle/schema/delivery";
import type {
  DeliveryType,
  EntitlementAdminAction,
  EntitlementStatus,
  EntitlementView,
  ProvisioningState,
} from "@/modules/entitlements/types";

/** Everything a handler may need beyond the row; loaded once by the service, never re-queried by handlers. */
export interface DeliveryHandlerContext {
  /** Admin who granted/revoked, or `null` for system paths (payment confirm, cron, refund). */
  actorId: string | null;
  requestId: string;
  offering: {
    id: string;
    name: string;
    deliveryConfig: DeliveryConfig;
    serviceSteps: ServiceStep[] | null;
    purchaseModel: "one_time" | "subscription" | "custom_quote";
  };
  product: { id: string; name: string; slug: string };
  customer: { id: string; email: string; name: string | null };
  /** `null` unless the offering is a subscription. */
  subscription: Subscription | null;
  /** `true` for API-DEL-11 grants (no order). */
  manualGrant: boolean;
}

export interface GrantOutcome {
  /** Status the service writes; download/license/SaaS-manual are `active` on grant (MASTER_SPEC §7). */
  status: Extract<EntitlementStatus, "pending" | "active">;
  provisioningState: ProvisioningState;
  /** `delivery_tasks` rows the handler inserted (ids returned for API-DEL output). */
  taskIds: string[];
  /** Emails the service must enqueue after commit (template keys from docs/06 `E:` column). */
  emails: Array<{ template: string; data: Record<string, unknown> }>;
}

export interface RevocationInput {
  /** `hard` = refund / admin revoke; `soft` = subscription suspended after grace (BR-14). */
  mode: "hard" | "soft";
  reason: string | null;
}

export interface RevokeOutcome {
  /** `true` when access was cut without human work (downloads/keys hidden, D-607). */
  automatic: boolean;
  /** Set when the handler opened `delivery_tasks(revoke_external)`. */
  taskId?: string;
}

/** Loaded rows the customer view is rendered from (no I/O inside handlers). */
export interface CustomerViewSource {
  entitlement: Entitlement;
  ctx: DeliveryHandlerContext;
  serviceProgress: ServiceProgress[];
  releaseFiles: Array<{
    mediaId: string;
    version: string;
    name: string;
    sizeBytes: number;
    releasedAt: Date;
    notes: string | null;
  }>;
  openTasks: DeliveryTask[];
}

/** Per-type slice of `EntitlementView` (API-DEL-01); the service merges it with the common fields. */
export type CustomerDeliveryView =
  | { type: "download"; downloads: NonNullable<EntitlementView["downloads"]> }
  | { type: "license"; licenseKeyMasked: string | null; keyIssued: boolean }
  | { type: "saas" | "hosted"; provisioning: NonNullable<EntitlementView["provisioning"]> }
  | {
      type: "service";
      serviceProgress: NonNullable<EntitlementView["serviceProgress"]>;
      fulfilled: boolean;
    }
  | { type: "custom"; custom: NonNullable<EntitlementView["custom"]> };

export interface DeliveryHandler<T extends DeliveryType = DeliveryType> {
  readonly type: T;

  /** Runs inside the granting transaction; must not commit, throw `AppError` to abort the grant. */
  onGranted(
    ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    tx: TxCtx,
  ): Promise<GrantOutcome>;

  /** Runs inside the revoking transaction after the status update. */
  onRevoked(
    ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    revocation: RevocationInput,
    tx: TxCtx,
  ): Promise<RevokeOutcome>;

  /**
   * Pure: builds the customer-facing slice from loaded rows. Suspended/expired/revoked rows must
   * hide files and keys (docs/06 §5.3 step 5).
   */
  customerView(source: CustomerViewSource): CustomerDeliveryView;

  /** Pure: admin buttons for this row (SCR-ADM-12), with `enabled` derived from state. */
  adminActions(entitlement: Entitlement, openTasks: DeliveryTask[]): EntitlementAdminAction[];

  /** Pure: contributes to "Order fulfilled" (service → all steps done; others → `active`). */
  isFulfilled(entitlement: Entitlement, serviceProgress: ServiceProgress[]): boolean;
}

export interface DeliveryHandlerRegistry {
  register(handler: DeliveryHandler): void;
  /** Throws `RangeError` for a type without a handler (a programming error, not an `AppError`). */
  get<T extends DeliveryType>(type: T): DeliveryHandler<T>;
  has(type: DeliveryType): boolean;
  types(): DeliveryType[];
}

/** Minimal in-memory registry; P5 registers the six handlers at module load, tests register fakes. */
export function createDeliveryHandlerRegistry(): DeliveryHandlerRegistry {
  const handlers = new Map<DeliveryType, DeliveryHandler>();
  return {
    register(handler) {
      if (handlers.has(handler.type)) {
        throw new RangeError(`delivery handler for '${handler.type}' already registered`);
      }
      handlers.set(handler.type, handler);
    },
    get<T extends DeliveryType>(type: T): DeliveryHandler<T> {
      const handler = handlers.get(type);
      if (handler === undefined) throw new RangeError(`no delivery handler for '${type}'`);
      return handler as DeliveryHandler<T>;
    },
    has: (type) => handlers.has(type),
    types: () => Array.from(handlers.keys()),
  };
}
