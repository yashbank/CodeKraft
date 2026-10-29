// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const base = {
  APP_ENV: "preview",
  EMAIL_ALLOWLIST: "@example.com",
  NEXT_PUBLIC_SITE_URL: "https://codekraft.test",
  NEXT_PUBLIC_ADMIN_URL: "https://admin.codekraft.test",
  ADMIN_HOST: "admin.codekraft.test",
  DATABASE_URL: "postgres://u:p@h/db",
  BETTER_AUTH_SECRET: "x".repeat(40),
  BETTER_AUTH_URL: "https://codekraft.test",
  R2_BUCKET_PUBLIC: "codekraft-dev-public",
  R2_BUCKET_PRIVATE: "codekraft-dev-private",
  R2_BUCKET_DOCUMENTS: "codekraft-dev-documents",
  R2_BUCKET_BACKUPS: "codekraft-dev-backups",
  EMAIL_FROM: "CodeKraft <hello@codekraft.test>",
  RESEND_API_KEY: "re_test",
  EMAIL_TRANSPORT: "resend",
};

const sendMock = vi.fn(async (_m: Record<string, unknown>) => ({
  data: { id: "msg_1" },
  error: null,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

let stored: string | null = null;
vi.mock("@/lib/site-brand", () => ({
  getSiteName: async () => "CodeKraft",
  getSiteLogo: async () => null,
  getStoredEmailFrom: async () => stored,
}));

async function load() {
  vi.resetModules();
  for (const [k, v] of Object.entries(base)) process.env[k] = v;
  (await import("@/lib/env")).resetEnvCache();
  return import("@/lib/email/transport");
}
const msg = { to: "a@example.com", subject: "Hi", template: "verify-email", data: {} } as const;

describe("P14-04 stored From", () => {
  beforeEach(() => {
    sendMock.mockClear();
    stored = null;
  });

  it("sendEmail uses the stored From instead of EMAIL_FROM", async () => {
    stored = "Acme Studio <mail@acme.test>";
    const t = await load();
    await t.sendEmail({ ...msg });
    expect(sendMock.mock.calls[0]![0]).toMatchObject({ from: "Acme Studio <mail@acme.test>" });
  });

  it("falls back to EMAIL_FROM when nothing is stored", async () => {
    const t = await load();
    await t.sendEmail({ ...msg });
    expect(sendMock.mock.calls[0]![0]).toMatchObject({ from: "CodeKraft <hello@codekraft.test>" });
  });

  it("a valid stored From clears the sender-problem banner for a placeholder env From", async () => {
    const t = await load();
    const env = { ...base, EMAIL_FROM: "x <a@resend.dev>" } as never;
    expect(t.emailSenderProblem(env)).toMatch(/placeholder/);
    expect(t.emailSenderProblem(env, "Acme <mail@acme.test>")).toBeNull();
  });
});

describe("P14-04 formatFrom + validation", () => {
  it("formats name + address, defaulting the name to the site name", async () => {
    const { formatFrom } = await import("@/lib/email/from");
    expect(formatFrom("Acme", "m@acme.test", "Site")).toBe("Acme <m@acme.test>");
    expect(formatFrom(null, "m@acme.test", "Site")).toBe("Site <m@acme.test>");
    expect(formatFrom('A"c<me>', "m@acme.test", "Site")).toBe("Acme <m@acme.test>");
    expect(formatFrom("Acme", null, "Site")).toBeNull();
    expect(formatFrom("Acme", "not-an-email", "Site")).toBeNull();
  });

  it("settings contract validates the keys server-side", async () => {
    const { updateSettingsSchema } = await import("@/modules/settings/contracts");
    const ok = updateSettingsSchema.safeParse({
      patch: { emailFromName: "Acme", emailFromAddress: "m@acme.test" },
    });
    expect(ok.success).toBe(true);
    for (const patch of [
      { emailFromAddress: "nope" },
      { emailFromName: "x".repeat(81) },
      { emailFromName: "bad<name>" },
    ])
      expect(updateSettingsSchema.safeParse({ patch }).success).toBe(false);
    expect(
      updateSettingsSchema.safeParse({ patch: { emailFromName: null, emailFromAddress: null } })
        .success,
    ).toBe(true);
  });
});
