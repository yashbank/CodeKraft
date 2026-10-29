// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/transport", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  emailConfigProblems: () => [],
}));
vi.mock("@/lib/site-brand", () => ({ getSiteName: async () => "CodeKraft" }));
vi.mock("@sentry/nextjs", () => ({}));

import { bootstrapPorts } from "@/lib/bootstrap";
import { sendAuthMail } from "@/modules/auth/mailer";

describe("forgot-password email path", () => {
  it("Better Auth's sendResetPassword mail goes through sendEmail with the reset-password template", async () => {
    bootstrapPorts();
    await sendAuthMail({
      kind: "reset_password",
      to: "u@example.com",
      url: "https://x/auth/reset?token=t",
      token: "t",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "u@example.com",
        template: "reset-password",
        data: { url: "https://x/auth/reset?token=t" },
      }),
    );
  });
});
