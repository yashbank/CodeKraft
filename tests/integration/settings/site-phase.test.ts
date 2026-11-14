import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { getDb } from "@/lib/db";
import { emailOutboxRetryJob } from "@/jobs/email-outbox";
import { getSitePhaseFresh } from "@/lib/site-phase-server";
import { settingsService } from "@/modules/settings/service";
import { emailOutbox } from "../../../drizzle/schema/notifications";
import { createUser } from "../../factories/users";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const events = vi.hoisted(() => [] as string[]);
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => events.push(`revalidate:${tag}`),
  revalidatePath: () => {},
  unstable_cache: (fn: () => unknown) => fn,
}));
vi.mock("@/lib/db", async (orig) => {
  const real = await orig<typeof import("@/lib/db")>();
  return {
    ...real,
    withTx: async (...args: Parameters<typeof real.withTx>) => {
      const out = await real.withTx(...args);
      events.push("commit");
      return out;
    },
  };
});

describe("site phase setting", () => {
  const sql = getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll(sql);
    events.length = 0;
  });

  const ctxFor = async (role: "super_admin" | "admin") => {
    const u = await createUser({ role });
    return buildContext({ user: { id: u.id }, session: { id: "s" }, roles: [role] });
  };

  it("defaults to live with no stored row", async () => {
    expect((await settingsService.load()).sitePhase).toBe("live");
    expect(await getSitePhaseFresh()).toBe("live");
  });

  it("super admin saves the phase: persisted, audited, caches revalidated after COMMIT", async () => {
    const ctx = await ctxFor("super_admin");
    await settingsService.updateSettings(ctx, { patch: { sitePhase: "maintenance" } });
    expect(await getSitePhaseFresh()).toBe("maintenance");
    expect((await settingsService.load()).sitePhase).toBe("maintenance");
    const commit = events.indexOf("commit");
    expect(commit).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("revalidate:settings")).toBeGreaterThan(commit);
    expect(events.slice(0, commit)).toEqual([]);
    const audit = await sql`select 1 from audit_logs where action = 'API-ADM-10 settings.update'`;
    expect(audit.length).toBe(1);
  });

  it("a normal admin cannot change it, and invalid values are rejected", async () => {
    const admin = await ctxFor("admin");
    await expect(
      settingsService.updateSettings(admin, { patch: { sitePhase: "testing" } }),
    ).rejects.toThrow();
    const sa = await ctxFor("super_admin");
    await expect(
      settingsService.updateSettings(sa, { patch: { sitePhase: "bogus" as never } }),
    ).rejects.toThrow();
    expect(await getSitePhaseFresh()).toBe("live");
  });

  it("testing: outbox skips customer mail (recorded, never sent) but still sends to staff", async () => {
    const sa = await ctxFor("super_admin");
    const staff = await createUser({ role: "admin", email: "boss@test.com" });
    await settingsService.updateSettings(sa, { patch: { sitePhase: "testing" } });
    const db = getDb();
    await db.insert(emailOutbox).values([
      { toEmail: "customer@example.com", template: "test-email", payload: {}, priority: 1 },
      { toEmail: staff.email, template: "test-email", payload: {}, priority: 1 },
    ]);
    await emailOutboxRetryJob.run();
    const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.template, "test-email"));
    const cust = rows.find((r) => r.toEmail === "customer@example.com")!;
    const adm = rows.find((r) => r.toEmail === staff.email)!;
    expect(cust.status).toBe("failed");
    expect(cust.lastError).toContain("skipped-by-phase");
    expect(cust.attempts).toBe(5);
    expect(adm.status).toBe("sent");
  });

  it("live: customer mail is processed normally", async () => {
    const db = getDb();
    await db.insert(emailOutbox).values({
      toEmail: "customer@example.com",
      template: "test-email",
      payload: {},
      priority: 1,
    });
    await emailOutboxRetryJob.run();
    const [r] = await db.select().from(emailOutbox);
    expect(r?.status).toBe("sent");
  });
});
