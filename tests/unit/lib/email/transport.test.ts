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

const siteNameMock = vi.fn(async () => "CodeKraft");
vi.mock("@/lib/site-brand", () => ({ getSiteName: () => siteNameMock() }));

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

  it("brands the subject and From name with the admin-set site name (R8-11)", async () => {
    siteNameMock.mockResolvedValueOnce("Acme Studio");
    const t = await load("resend");
    await t.sendEmail({
      to: "founder@example.com",
      subject: "Verify your CodeKraft email",
      template: "verify-email",
      data: { url: "https://x/y" },
    });
    const sent = (sendMock.mock.calls as unknown as Array<[Record<string, string>]>)[0]![0];
    expect(sent.subject).toBe("Verify your Acme Studio email");
    expect(sent.from).toBe("Acme Studio <hello@codekraft.test>");
    expect(sent.html).toContain("Acme Studio");
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

describe("R8-07 verification email delivery root causes", () => {
  beforeEach(() => {
    sendMock.mockClear();
    delete process.env.VERCEL_ENV;
  });

  it("a Vercel production deploy with a non-production APP_ENV still mails any customer", async () => {
    const t = await load("resend");
    process.env.VERCEL_ENV = "production";
    try {
      const r = await t.sendEmail({
        to: "new.customer@gmail.com",
        subject: "Verify",
        template: "verify-email",
        data: { url: "https://x/verify" },
        priority: 1,
      });
      expect(r.skipped).toBeUndefined();
      expect(sendMock).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.VERCEL_ENV;
    }
  });

  it("outside production the allowlist still blocks non-listed recipients", async () => {
    const t = await load("resend");
    const r = await t.sendEmail({
      to: "new.customer@gmail.com",
      subject: "Verify",
      template: "verify-email",
      data: {},
    });
    expect(r.skipped).toBe("allowlist");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("a Resend rejection is thrown (and logged), never swallowed", async () => {
    const t = await load("resend");
    sendMock.mockImplementationOnce(
      async () =>
        ({
          data: null,
          error: { name: "validation_error", message: "domain is not verified" },
        }) as never,
    );
    await expect(
      t.sendEmail({ to: "founder@example.com", subject: "s", template: "verify-email", data: {} }),
    ).rejects.toThrow(/domain is not verified/);
  });

  it("emailConfigProblems flags the misconfigurations that silently drop mail", async () => {
    const t = await load("resend");
    const healthy = {
      APP_ENV: "production" as const,
      EMAIL_TRANSPORT: "resend" as const,
      EMAIL_FROM: "CodeKraft <no-reply@codekraft.in>",
      RESEND_API_KEY: "re_live",
      EMAIL_ALLOWLIST: [],
    };
    expect(t.emailConfigProblems(healthy, undefined)).toEqual([]);
    // Local/preview is not a live deployment: nothing to report.
    expect(t.emailConfigProblems({ ...healthy, APP_ENV: "local" }, undefined)).toEqual([]);

    const live = t
      .emailConfigProblems(
        {
          APP_ENV: "local",
          EMAIL_TRANSPORT: "log",
          EMAIL_FROM: "CodeKraft <onboarding@resend.dev>",
          RESEND_API_KEY: undefined,
          EMAIL_ALLOWLIST: [],
        },
        "production",
      )
      .join("\n");
    expect(live).toMatch(/APP_ENV/);
    expect(live).toMatch(/EMAIL_TRANSPORT/);
    expect(live).toMatch(/resend\.dev/);
    expect(
      t.emailConfigProblems({ ...healthy, RESEND_API_KEY: undefined }, undefined).join(),
    ).toMatch(/RESEND_API_KEY/);
  });
});

describe("P1-05 email failure visibility", () => {
  it("logs and rethrows an SDK throw (network etc.), never swallowed", async () => {
    const t = await load("resend");
    const spy = vi.spyOn((await import("@/lib/logger")).getLogger(), "child");
    const error = vi.fn();
    spy.mockReturnValue({ error, info: vi.fn(), warn: vi.fn() } as never);
    sendMock.mockImplementationOnce(async () => {
      throw new Error("network down");
    });
    await expect(
      t.sendEmail({ to: "founder@example.com", subject: "s", template: "custom-quote", data: {} }),
    ).rejects.toThrow(/network down/);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ template: "custom-quote" }),
      "email send failed",
    );
    spy.mockRestore();
  });

  it("emailSenderProblem reports missing key/from and placeholder domains", async () => {
    const t = await load("resend");
    const ok = {
      EMAIL_TRANSPORT: "resend" as const,
      EMAIL_FROM: "CodeKraft <no-reply@codekraft.in>",
      RESEND_API_KEY: "re_live",
    };
    expect(t.emailSenderProblem(ok)).toBeNull();
    expect(t.emailSenderProblem({ ...ok, EMAIL_TRANSPORT: "log" })).toMatch(/EMAIL_TRANSPORT/);
    expect(t.emailSenderProblem({ ...ok, RESEND_API_KEY: undefined })).toMatch(/RESEND_API_KEY/);
    expect(t.emailSenderProblem({ ...ok, EMAIL_FROM: "" })).toMatch(/EMAIL_FROM/);
    expect(t.emailSenderProblem({ ...ok, EMAIL_FROM: "CK <a@example.invalid>" })).toMatch(
      /placeholder/,
    );
    expect(t.emailSenderProblem({ ...ok, EMAIL_FROM: "onboarding@resend.dev" })).toMatch(
      /placeholder/,
    );
  });

  it("only the transport talks to Resend (verify, invite, quote, invoice share sendEmail)", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync('grep -rlE "from .resend.|emails\\.send" src || true', {
      encoding: "utf8",
    });
    expect(out.split("\n").filter(Boolean)).toEqual(["src/lib/email/transport.ts"]);
  });
});
