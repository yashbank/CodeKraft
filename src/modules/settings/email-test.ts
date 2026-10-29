"use server";

/**
 * P14-04 — "Send test email" (Settings → Email). `settings.write`-gated; always goes to the
 * signed-in admin's own address. `resend` sends for real through `sendEmail`; any other
 * transport enqueues an `email_outbox` row carrying the resolved From so the setup can be checked
 * without a verified domain.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/envelope";

export const sendTestEmailAction = defineAction({
  name: "settings.email.send_test",
  permission: "settings.write",
  input: z.object({}).strict(),
  handler: async (_input, ctx) => {
    // Lazy: this file is imported by the client SettingsScreen; keep server-only modules out of its graph.
    const { db } = await import("@/lib/db");
    const { sendEmail } = await import("@/lib/email/transport");
    const { brandFromAddress } = await import("@/lib/email/branding");
    const { getEnv } = await import("@/lib/env");
    const { getSiteName, getStoredEmailFrom } = await import("@/lib/site-brand");
    const { users } = await import("../../../drizzle/schema/auth");
    const { emailOutbox } = await import("../../../drizzle/schema/notifications");
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    if (!user) throw new Error("Signed-in user not found");
    const env = getEnv();
    const siteName = await getSiteName();
    const from = (await getStoredEmailFrom()) ?? brandFromAddress(env.EMAIL_FROM, siteName);
    const subject = `${siteName} test email`;
    const data = { subject, from, test: true };
    if (env.EMAIL_TRANSPORT === "resend") {
      await sendEmail({ to: user.email, subject, template: "test-email", data, priority: 1 });
      return { to: user.email, from, delivered: true as const };
    }
    await db
      .insert(emailOutbox)
      .values({ toEmail: user.email, template: "test-email", payload: data, priority: 1 });
    return { to: user.email, from, delivered: false as const };
  },
});

/** Client-callable wrapper: no input; the admin context comes from the session. */
export async function sendTestEmail() {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    return await sendTestEmailAction({}, await getAdminRequestContext());
  } catch (err) {
    return fail(err);
  }
}
