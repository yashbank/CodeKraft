// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const base = {
  APP_ENV: "preview",
  NEXT_PUBLIC_SITE_URL: "https://preview.codekraft.test",
  NEXT_PUBLIC_ADMIN_URL: "https://admin-preview.codekraft.test",
  ADMIN_HOST: "admin-preview.codekraft.test",
  DATABASE_URL: "postgres://u:p@h/db",
  BETTER_AUTH_SECRET: "x".repeat(40),
  BETTER_AUTH_URL: "https://preview.codekraft.test",
  R2_BUCKET_PUBLIC: "codekraft-dev-public",
  R2_BUCKET_PRIVATE: "codekraft-dev-private",
  R2_BUCKET_DOCUMENTS: "codekraft-dev-documents",
  R2_BUCKET_BACKUPS: "codekraft-dev-backups",
  EMAIL_FROM: "CodeKraft <hello@codekraft.test>",
  RESEND_API_KEY: "re_test",
  EMAIL_ALLOWLIST: "founder@example.com,@iauro.com",
};

const sendMock = vi.fn(async () => ({ data: { id: "msg_1" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

async function load(transport: string) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...base, EMAIL_TRANSPORT: transport })) process.env[k] = v;
  const env = await import("@/lib/env");
  env.resetEnvCache();
  const t = await import("@/lib/email/transport");
  t.resetDailyCounter();
  return t;
}

describe("email transport (docs/12 §7)", () => {
  beforeEach(() => sendMock.mockClear());

  it("log transport never sends", async () => {
    const t = await load("log");
    const r = await t.sendEmail({
      to: "anyone@example.com",
      subject: "s",
      template: "verify-email",
      data: {},
    });
    expect(r.transport).toBe("log");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("outbox transport calls the port once", async () => {
    const t = await load("outbox");
    const enqueue = vi.fn(async () => ({ id: "ob_1" }));
    t.setEmailOutbox({ enqueue });
    const r = await t.sendEmail({ to: "a@b.c", subject: "s", template: "verify-email", data: {} });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ transport: "outbox", id: "ob_1" });
  });

  it("resend outside production blocks recipients not on the allowlist and allows listed ones", async () => {
    const t = await load("resend");
    const blocked = await t.sendEmail({
      to: "stranger@example.org",
      subject: "s",
      template: "verify-email",
      data: { url: "https://x/y" },
    });
    expect(blocked.skipped).toBe("allowlist");
    expect(sendMock).not.toHaveBeenCalled();
    const ok = await t.sendEmail({
      to: "pravin@iauro.com",
      subject: "s",
      template: "verify-email",
      data: { url: "https://x/y" },
    });
    expect(ok.id).toBe("msg_1");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("defers non-urgent mail past the daily soft cap but lets urgent mail through", async () => {
    const t = await load("resend");
    for (let i = 0; i < t.DAILY_SOFT_CAP; i++)
      await t.sendEmail({
        to: "founder@example.com",
        subject: "s",
        template: "query-reply",
        data: {},
      });
    const deferred = await t.sendEmail({
      to: "founder@example.com",
      subject: "s",
      template: "admin-overdue-digest",
      data: {},
      priority: 9,
    });
    expect(deferred.skipped).toBe("daily_cap");
    const urgent = await t.sendEmail({
      to: "founder@example.com",
      subject: "s",
      template: "verify-email",
      data: { url: "u" },
      priority: 1,
    });
    expect(urgent.skipped).toBeUndefined();
  });
});
