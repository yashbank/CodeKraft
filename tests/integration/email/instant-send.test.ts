import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, withTx } from "@/lib/db";
import { emailOutboxRetryJob, sendFreshOutbox } from "@/jobs/email-outbox";
import { emailOutbox } from "../../../drizzle/schema/notifications";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";

process.env.EMAIL_TRANSPORT = "resend";
process.env.EMAIL_ALLOWLIST = "@test.com";
process.env.RESEND_API_KEY = "re_test";
process.env.EMAIL_FROM = "Test <a@test.com>";

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/transport", () => ({ sendEmail }));

const row = { toEmail: "c@test.com", template: "test-email", payload: {}, priority: 1 };
const waitFor = async (fn: () => Promise<boolean>) => {
  for (let i = 0; i < 50; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("timed out");
};
const status = async () => (await getDb().select().from(emailOutbox))[0];

describe("instant outbox send", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ transport: "resend" });
  });

  it("sends right after the enclosing transaction commits (no request scope needed)", async () => {
    await withTx(async (tx) => {
      await tx.insert(emailOutbox).values(row);
      expect(sendEmail).not.toHaveBeenCalled(); // not before commit
    });
    await waitFor(async () => (await status())?.status === "sent");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the transaction rolls back", async () => {
    await expect(
      withTx(async (tx) => {
        await tx.insert(emailOutbox).values(row);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await sendFreshOutbox();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a failed immediate send does not fail the action and the cron retries it", async () => {
    sendEmail.mockRejectedValueOnce(new Error("resend down"));
    await expect(withTx((tx) => tx.insert(emailOutbox).values(row))).resolves.toBeDefined();
    await waitFor(async () => (await status())?.status === "failed");
    await emailOutboxRetryJob.run();
    expect((await status())?.status).toBe("sent");
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("overlapping immediate send and cron send a row only once", async () => {
    await getDb().insert(emailOutbox).values(row);
    await Promise.all([sendFreshOutbox(), emailOutboxRetryJob.run(), sendFreshOutbox()]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(
      (await getDb().select().from(emailOutbox).where(eq(emailOutbox.status, "sent"))).length,
    ).toBe(1);
  });
});
