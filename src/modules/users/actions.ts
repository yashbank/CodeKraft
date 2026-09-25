"use server";

/**
 * Users Server Actions (API-AUTH-03..08, API-ADM-07..09/11/12, PHASE-03 P3.4).
 * Uses defineAction / definePublicAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  changeAdminRoleSchema,
  changeEmailRequestSchema,
  changePasswordSchema,
  customerStatusChangeSchema,
  deleteAccountSchema,
  disableTotpSchema,
  enableTotpSchema,
  inviteAdminSchema,
  removeAdminSchema,
  revokeSessionSchema,
  sendAuthLinkSchema,
  updateAccountSettingsSchema,
  updateCustomerNotesSchema,
  updatePartnerSchema,
  updateProfileSchema,
  verifyTotpSchema,
} from "./contracts";
import { usersService } from "./service";

export const updateProfileAction = defineAction({
  name: "API-AUTH-03 profile.update",
  input: updateProfileSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.updateProfile(ctx, input),
});

export const updateAccountSettingsAction = defineAction({
  name: "API-AUTH-04 settings.update_account",
  input: updateAccountSettingsSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.updateSettings(ctx, input),
});

export const changeEmailRequestAction = defineAction({
  name: "API-AUTH-05 email.change_request",
  input: changeEmailRequestSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.changeEmailRequest(ctx, input),
});

export const changePasswordAction = defineAction({
  name: "API-AUTH-05 password.change",
  input: changePasswordSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.changePassword(ctx, input),
});

export const revokeSessionAction = defineAction({
  name: "API-AUTH-06 session.revoke",
  input: revokeSessionSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.revokeSession(ctx, input),
});

export const enableTotpAction = defineAction({
  name: "API-AUTH-07 totp.enable",
  input: enableTotpSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.enableTotp(ctx, input),
});

export const verifyTotpAction = defineAction({
  name: "API-AUTH-07 totp.verify",
  input: verifyTotpSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.verifyTotp(ctx, input),
});

export const disableTotpAction = defineAction({
  name: "API-AUTH-07 totp.disable",
  input: disableTotpSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.disableTotp(ctx, input),
});

export const deleteAccountAction = defineAction({
  name: "API-AUTH-08 account.delete",
  input: deleteAccountSchema,
  permission: "account.self",
  handler: (input, ctx) => usersService.deleteAccount(ctx, input),
});

export const updateCustomerNotesAction = defineAction({
  name: "API-ADM-07 customer.update_notes",
  input: updateCustomerNotesSchema,
  permission: "customers.notes.write",
  handler: (input, ctx) => usersService.updateCustomerNotes(ctx, input),
});

export const suspendCustomerAction = defineAction({
  name: "API-ADM-08 customer.suspend",
  input: customerStatusChangeSchema,
  permission: "customers.suspend",
  handler: (input, ctx) => usersService.suspendCustomer(ctx, input),
});

export const reinstateCustomerAction = defineAction({
  name: "API-ADM-08 customer.reinstate",
  input: customerStatusChangeSchema,
  permission: "customers.suspend",
  handler: (input, ctx) => usersService.reinstateCustomer(ctx, input),
});

export const sendResetLinkAction = defineAction({
  name: "API-ADM-09 customer.send_reset_link",
  input: sendAuthLinkSchema,
  permission: "customers.reset_link",
  handler: (input, ctx) => usersService.sendResetLink(ctx, input),
});

export const sendMagicLinkAction = defineAction({
  name: "API-ADM-09 customer.send_magic_link",
  input: sendAuthLinkSchema,
  permission: "customers.reset_link",
  handler: (input, ctx) => usersService.sendMagicLink(ctx, input),
});

export const inviteAdminAction = defineAction({
  name: "API-ADM-11 admin.invite",
  input: inviteAdminSchema,
  permission: "users.admin.manage",
  handler: (input, ctx) => usersService.inviteAdmin(ctx, input),
});

export const changeAdminRoleAction = defineAction({
  name: "API-ADM-11 admin.change_role",
  input: changeAdminRoleSchema,
  permission: "users.admin.manage",
  handler: (input, ctx) => usersService.changeAdminRole(ctx, input),
});

export const removeAdminAction = defineAction({
  name: "API-ADM-11 admin.remove",
  input: removeAdminSchema,
  permission: "users.admin.manage",
  handler: (input, ctx) => usersService.removeAdmin(ctx, input),
});

export const updatePartnerAction = defineAction({
  name: "API-ADM-12 partner.update",
  input: updatePartnerSchema,
  permission: "users.admin.manage",
  handler: (input, ctx) => usersService.updatePartner(ctx, input),
});
