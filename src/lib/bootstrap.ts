/** Wires ports that need runtime services: auth mail → email transport, action errors → Sentry. */
import * as Sentry from "@sentry/nextjs";

import { setActionErrorReporter } from "@/lib/actions/envelope";
import { emailConfigProblems, sendEmail } from "@/lib/email/transport";
import { getEnv } from "@/lib/env";
import { getLogger } from "@/lib/logger";
import { setAuthMailer } from "@/modules/auth/mailer";

let done = false;

export function bootstrapPorts(): void {
  if (done) return;
  done = true;
  reportEmailConfig();
  setAuthMailer(async (mail) => {
    switch (mail.kind) {
      case "verify_email":
        await sendEmail({
          to: mail.to,
          template: "verify-email",
          subject: "Verify your CodeKraft email",
          data: { url: mail.url },
        });
        break;
      case "reset_password":
        await sendEmail({
          to: mail.to,
          template: "reset-password",
          subject: "Reset your CodeKraft password",
          data: { url: mail.url },
        });
        break;
      case "change_email":
        await sendEmail({
          to: mail.to,
          template: "change-email",
          subject: "Confirm your new CodeKraft email",
          data: { url: mail.url },
        });
        break;
      case "phone_otp":
        // SMS provider arrives with the phone_otp flag (P12); until then the code is logged by the log transport.
        await sendEmail({
          to: mail.to,
          template: "phone-otp",
          subject: "Your CodeKraft code",
          data: { code: mail.code },
        });
        break;
    }
  });
  setActionErrorReporter((err, report) =>
    Sentry.captureException(err, {
      tags: { action: report.action },
      extra: { incidentId: report.incidentId, requestId: report.requestId },
      user: report.userId ? { id: report.userId } : undefined,
    }),
  );
}

/** R8-07: surface mail misconfiguration at boot instead of only when a customer's email vanishes. */
function reportEmailConfig(): void {
  try {
    const problems = emailConfigProblems(getEnv());
    if (problems.length > 0) {
      getLogger().error(
        { problems },
        "email misconfigured: verification/reset emails will not arrive",
      );
    }
  } catch {
    // getEnv() throws on an invalid environment; that failure is reported where env is used.
  }
}
