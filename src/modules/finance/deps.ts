/**
 * Finance dependency ports (P4.1, master plan §5). The service is built with
 * `createFinanceService(deps)`; `financeService` uses the process-wide deps which default to
 * built-in implementations for everything that can be answered from the database alone
 * (ownership version at an instant, FX rate, audit row) and to "unwired" ports for the
 * services other modules own (approvals, notifications). Bootstrap (P9) calls
 * `configureFinanceDeps({ approvals: approvalsService, … })`; tests pass fakes.
 */
import type { ApprovalsService } from "@/modules/approvals/contracts";
import type { AuditService } from "@/modules/audit/contracts";
import type { NotificationsService } from "@/modules/notifications/contracts";
import type { OwnershipService } from "@/modules/ownership/contracts";
import { type DbOrTx, type TxCtx, db as rootDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { Currency } from "@/lib/money";
import { getLogger } from "@/lib/logger";
import { defaultAuditLog, defaultOwnershipAt, defaultRateToInr } from "./lookups";
import { type DocumentStore, createR2DocumentStore } from "./statement-store";

export interface FxPort {
  /** `numeric(18,8)` decimal string for 1 unit of `currency` in INR on the IST day of `asOf`. */
  rateToInr(currency: Currency, asOf: Date, tx: DbOrTx): Promise<string>;
}

export interface FinanceDeps {
  /** Root client (production) or the test transaction; queries read through it directly. */
  db: DbOrTx;
  ownership: Pick<OwnershipService, "getActiveAt">;
  fx: FxPort;
  approvals: Pick<ApprovalsService, "request">;
  audit: Pick<AuditService, "log">;
  notifications: Pick<NotificationsService, "emit">;
  documents: DocumentStore;
  now(): Date;
}

function unwired<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      return () =>
        Promise.reject(
          new AppError(
            ErrorCode.INTERNAL,
            `finance: ${name}.${String(prop)} is not wired (configureFinanceDeps)`,
          ),
        );
    },
  });
}

/** Built-in defaults (see module header). */
export function defaultFinanceDeps(): FinanceDeps {
  return {
    db: rootDb,
    ownership: { getActiveAt: (productId, at, tx) => defaultOwnershipAt(productId, at, tx) },
    fx: { rateToInr: defaultRateToInr },
    approvals: unwired<Pick<ApprovalsService, "request">>("approvals"),
    audit: { log: defaultAuditLog },
    notifications: {
      emit: (target, type, payload, _channels, _tx: TxCtx) => {
        getLogger().info({ target, type, payload }, "finance notification (unwired)");
        return Promise.resolve({ notificationIds: [], recipients: 0 } as never);
      },
    },
    documents: createR2DocumentStore(),
    now: () => new Date(),
  };
}

let current: FinanceDeps = defaultFinanceDeps();

/** Replace some or all ports (bootstrap wiring, tests). Returns the effective deps. */
export function configureFinanceDeps(overrides: Partial<FinanceDeps>): FinanceDeps {
  current = { ...current, ...overrides };
  return current;
}

export function resetFinanceDeps(): void {
  current = defaultFinanceDeps();
}

export function getFinanceDeps(): FinanceDeps {
  return current;
}

/** Deps that resolve the process-wide configuration at call time (used by `financeService`). */
export const lazyFinanceDeps: FinanceDeps = {
  get db() {
    return current.db;
  },
  ownership: { getActiveAt: (...args) => current.ownership.getActiveAt(...args) },
  fx: { rateToInr: (...args) => current.fx.rateToInr(...args) },
  approvals: {
    request: ((...args: Parameters<ApprovalsService["request"]>) =>
      current.approvals.request(...args)) as ApprovalsService["request"],
  },
  audit: { log: (...args) => current.audit.log(...args) },
  notifications: { emit: (...args) => current.notifications.emit(...args) },
  documents: { put: (...args) => current.documents.put(...args) },
  now: () => current.now(),
};
