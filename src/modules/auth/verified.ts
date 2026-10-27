/**
 * Email-verification gate (R8-08, FR-AUTH-02, D-1201). Unverified customers may sign in, but
 * checkout, payment submission and the AI chatbot stay locked until the email is verified. The UI
 * shows a friendly prompt; this is the server-side enforcement every customer-facing mutation on
 * those paths calls, so a crafted request can't skip the UI.
 *
 * Admin-class users (staff/admin/super_admin) are exempt: they act on behalf of customers (e.g.
 * submitting a payment reference from the admin console) and are provisioned already verified.
 */
import { eq } from "drizzle-orm";

import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { users } from "../../../drizzle/schema/auth";

const ADMIN_CLASS_ROLES = new Set(["staff", "admin", "super_admin"]);

export const EMAIL_UNVERIFIED_MESSAGE =
  "Please verify your email address first. Check your inbox for the link, or resend it from your account.";

export function isAdminClass(ctx: Pick<RequestContext, "roles">): boolean {
  return ctx.roles.some((r) => ADMIN_CLASS_ROLES.has(r));
}

/** Throws `EMAIL_UNVERIFIED` (HTTP 403) unless the acting user's email is verified. */
export async function assertEmailVerified(
  ctx: Pick<RequestContext, "userId" | "roles">,
  database: DbOrTx,
  message: string = EMAIL_UNVERIFIED_MESSAGE,
): Promise<void> {
  if (isAdminClass(ctx)) return;
  const [row] = await database
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);
  if (!row?.emailVerified) throw new AppError(ErrorCode.EMAIL_UNVERIFIED, message);
}
