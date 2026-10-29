import { redirect } from "next/navigation";

/** P10: an admin-issued temporary password must be replaced before any authenticated page renders. */
export function enforcePasswordChange(session: { user: { mustChangePassword?: unknown } }): void {
  if (session.user.mustChangePassword === true) redirect("/auth/change-password");
}
