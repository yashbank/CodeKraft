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
    log.info(
      { to: message.to, template: message.template, subject: message.subject },
      "email (log transport, not sent)",
    );
    return { transport: "log" };
  }

  if (transport === "outbox") {
    if (!outbox) throw new Error("EMAIL_TRANSPORT=outbox but no EmailOutboxPort is registered");
    const { id } = await outbox.enqueue(message);
    return { transport: "outbox", id };
  }

  // resend
  if (!isAllowedRecipient(message.to, env.EMAIL_ALLOWLIST ?? [], env.APP_ENV)) {
    log.warn(
      { to: message.to, template: message.template },
      "recipient not in EMAIL_ALLOWLIST; skipped",
    );
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
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  return { transport: "resend", id: res.data?.id };
}
