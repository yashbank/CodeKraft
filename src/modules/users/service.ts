/**
 * `users` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `UsersService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { UsersService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "users.<method> not implemented (P3)")`. */
export function createNotImplementedUsersService(): UsersService {
  return createNotImplemented<UsersService>("users", "P3", {
    getMe: "async",
    updateProfile: "async",
    updateSettings: "async",
    changeEmailRequest: "async",
    changePassword: "async",
    listSessions: "async",
    revokeSession: "async",
    enableTotp: "async",
    verifyTotp: "async",
    disableTotp: "async",
    deleteAccount: "async",
    listCustomers: "async",
    getCustomer: "async",
    updateCustomerNotes: "async",
    suspendCustomer: "async",
    reinstateCustomer: "async",
    sendResetLink: "async",
    sendMagicLink: "async",
    inviteAdmin: "async",
    changeAdminRole: "async",
    removeAdmin: "async",
    applyAdminUserChange: "async",
    listPartners: "async",
    updatePartner: "async",
    getDashboardOverview: "async",
    getPaymentHistory: "async",
    getSecurityOverview: "async",
  });
}
