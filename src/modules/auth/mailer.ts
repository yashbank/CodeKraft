/**
 * Auth mail port. Better Auth calls these for verification, reset and OTP messages.
 * P1.8 wires the real transport (log/outbox/resend); the default logs the link so local dev works.
 */
import { getLogger } from "@/lib/logger";

export type AuthMail =
  | { kind: "verify_email"; to: string; url: string; token: string }
  | { kind: "reset_password"; to: string; url: string; token: string }
  | { kind: "change_email"; to: string; url: string; token: string }
  | { kind: "phone_otp"; to: string; code: string };

export type AuthMailer = (mail: AuthMail) => Promise<void>;

let mailer: AuthMailer = async (mail) => {
  getLogger().info(
    { authMail: { ...mail, token: undefined } },
    `auth mail (${mail.kind}) → ${mail.to}`,
  );
};

export function setAuthMailer(next: AuthMailer): void {
  mailer = next;
}

export function sendAuthMail(mail: AuthMail): Promise<void> {
  return mailer(mail);
}
