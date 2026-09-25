/**
 * `notifications` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P6; the signatures are
 * the frozen `NotificationsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { NotificationsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "notifications.<method> not implemented (P6)")`. */
export function createNotImplementedNotificationsService(): NotificationsService {
  return createNotImplemented<NotificationsService>("notifications", "P6", {
    emit: "async",
    listNotifications: "async",
    pollNotifications: "async",
    markRead: "async",
    markAllRead: "async",
    getNotificationPreferences: "async",
    updateNotificationPreferences: "async",
  });
}
