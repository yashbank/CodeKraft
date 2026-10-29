import { redirect } from "next/navigation";

import { AppError, ErrorCode } from "@/lib/errors";

type SessionLike = { user: { mustChangePassword?: unknown } };

/** P10: an admin-issued temporary password must be replaced before any authenticated page renders. */
export function enforcePasswordChange(session: SessionLike): void {
  if (session.user.mustChangePassword === true) redirect("/auth/change-password");
}

/** Server-side twin for actions and API routes (maps to HTTP 403). The change-password action and sign-out do not call it. */
export function assertNoPasswordChange(session: SessionLike): void {
  if (session.user.mustChangePassword === true)
    throw new AppError(ErrorCode.PASSWORD_CHANGE_REQUIRED);
}
