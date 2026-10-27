/**
 * Email transport selected by EMAIL_TRANSPORT (docs/12 §7, P1.8):
 *  - log:    never sends; logs recipient/subject (tests, local)
 *  - outbox: hands the message to the injected EmailOutboxPort (P2 table, P6 channel)
 *  - resend: Resend SDK; outside production honours EMAIL_ALLOWLIST; 90/100 daily guard (NFR-OPS-02)
 */
import { Resend } from "resend";

import { getEnv } from "@/lib/env";
import { getLogger } from "@/lib/logger";
import { renderGenericEmail } from "./render";
import type { EmailMessage, EmailOutboxPort, EmailSendResult } from "./types";

let outbox: EmailOutboxPort | null = null;
export function setEmailOutbox(port: EmailOutboxPort | null): void {
  outbox = port;
}

/** Daily counter (per process; the durable counter lives in email_outbox from P6). */
const daily = { day: "", count: 0 };
export const DAILY_SOFT_CAP = 90;
export function resetDailyCounter(): void {
  daily.day = "";
  daily.count = 0;
}
function bumpDaily(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) {
    daily.day = today;
    daily.count = 0;
  }
  return ++daily.count;
}

export function isAllowedRecipient(
  to: string,
  allowlist: readonly string[],
  appEnv: string,
): boolean {
  if (appEnv === "production") return true;
  const addr = to.toLowerCase();
  return allowlist.some((entry) => {
    const e = entry.toLowerCase().trim();
    if (!e) return false;
    if (e.startsWith("@")) return addr.endsWith(e);
    return addr === e;
  });
}

let resendClient: Resend | null = null;
function getResend(apiKey: string): Resend {
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const env = getEnv();
  const log = getLogger().child({ module: "email" });
  const transport = env.EMAIL_TRANSPORT;

  if (transport === "log") {
    if (isProductionDeployment(env.APP_ENV)) {
      // R8-07: on a real deployment this means customers never get mail -- say so loudly.
      log.error(
        { to: message.to, template: message.template },
        "EMAIL_TRANSPORT=log on a production deployment: email NOT delivered. Set EMAIL_TRANSPORT=resend.",
      );
    } else {
      log.info(
        { to: message.to, template: message.template, subject: message.subject },
        "email (log transport, not sent)",
      );
      // Local dev: verify/reset links live in `data`; print them so the flow can be completed.
      if (process.env.NODE_ENV === "development") {
        console.info("[dev-email]", {
          to: message.to,
          subject: message.subject,
          data: message.data,
        });
      }
    }
    return { transport: "log" };
  }

  if (transport === "outbox") {
    if (!outbox) throw new Error("EMAIL_TRANSPORT=outbox but no EmailOutboxPort is registered");
    const { id } = await outbox.enqueue(message);
    return { transport: "outbox", id };
  }

  // resend
  const allowlistEnv = isProductionDeployment(env.APP_ENV) ? "production" : env.APP_ENV;
  if (!isAllowedRecipient(message.to, env.EMAIL_ALLOWLIST ?? [], allowlistEnv)) {
    // R8-07: was a quiet `warn` -- a non-production APP_ENV on the live site silently dropped
    // every customer's verification email. Make it impossible to miss in the logs.
    log.error(
      { to: message.to, template: message.template, appEnv: env.APP_ENV },
      "email NOT sent: recipient not in EMAIL_ALLOWLIST (allowlist applies because APP_ENV is not production)",
    );
    if (process.env.NODE_ENV === "development") {
      // Dev only: surface the mail (verify/reset links live in `data`) on the server console.
      console.info("[dev-email] skipped by allowlist", {
        to: message.to,
        subject: message.subject,
        data: message.data,
      });
    }
    return { transport: "resend", skipped: "allowlist" };
  }
  const n = bumpDaily();
  if (n > DAILY_SOFT_CAP && (message.priority ?? 5) > 1) {
    log.warn({ n, template: message.template }, "daily soft cap reached; non-urgent mail deferred");
    return { transport: "resend", skipped: "daily_cap" };
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing for EMAIL_TRANSPORT=resend");
  const { html, text } = await renderGenericEmail(
    message.subject,
    message.data,
    env.NEXT_PUBLIC_SITE_URL,
  );
  const res = await getResend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to: message.to,
    replyTo: env.EMAIL_REPLY_TO || undefined,
    subject: message.subject,
    html,
    text,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
    headers: { "X-Entity-Ref-ID": `${message.template}:${Date.now()}` },
  });
  if (res.error) {
    // R8-07: Resend rejects (unverified sending domain, `onboarding@resend.dev` to a non-owner,
    // bad key, rate limit) used to surface only as a thrown message; log the details too.
    log.error(
      {
        to: message.to,
        template: message.template,
        from: env.EMAIL_FROM,
        resendError: { name: res.error.name, message: res.error.message },
      },
      "Resend rejected the email",
    );
    throw new Error(`Resend: ${res.error.message}`);
  }
  log.info({ to: message.to, template: message.template, id: res.data?.id }, "email sent (resend)");
  return { transport: "resend", id: res.data?.id };
}

/**
 * True on a real production deployment. `APP_ENV` defaults to "local" when unset, so a Vercel
 * production deploy missing `APP_ENV=production` would otherwise run with the dev allowlist on.
 */
export function isProductionDeployment(appEnv: string): boolean {
  return appEnv === "production" || process.env.VERCEL_ENV === "production";
}

/**
 * R8-07: startup self-check for the misconfigurations that make auth mail silently disappear.
 * Returns human-readable problems (empty when healthy); `bootstrapPorts` logs them once.
 */
export function emailConfigProblems(
  env: Pick<
    ReturnType<typeof getEnv>,
    "APP_ENV" | "EMAIL_TRANSPORT" | "EMAIL_FROM" | "RESEND_API_KEY" | "EMAIL_ALLOWLIST"
  >,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): string[] {
  const live = env.APP_ENV === "production" || vercelEnv === "production";
  if (!live) return [];
  const problems: string[] = [];
  if (env.APP_ENV !== "production") {
    problems.push(
      `APP_ENV is "${env.APP_ENV}" on a production deployment; set APP_ENV=production (the EMAIL_ALLOWLIST is bypassed automatically, but other production guards are off).`,
    );
  }
  if (env.EMAIL_TRANSPORT !== "resend") {
    problems.push(
      `EMAIL_TRANSPORT is "${env.EMAIL_TRANSPORT}"; no email is delivered. Set EMAIL_TRANSPORT=resend.`,
    );
  }
  if (env.EMAIL_TRANSPORT === "resend" && !env.RESEND_API_KEY) {
    problems.push("RESEND_API_KEY is not set; every send will fail.");
  }
  if (/@resend\.dev>?\s*$/i.test(env.EMAIL_FROM)) {
    problems.push(
      `EMAIL_FROM uses Resend's test sender (${env.EMAIL_FROM}), which only delivers to the Resend account owner. Verify your domain in Resend and set EMAIL_FROM="CodeKraft <no-reply@your-domain>".`,
    );
  }
  return problems;
}
