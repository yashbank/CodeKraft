import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { retentionPurgeTokensJob, usersAnonymiseSweepJob } from "@/jobs/retention";
import { entitlementsExpireJob, subscriptionsRemindGraceSuspendJob } from "@/jobs/subscriptions";
import { sessions, users, verifications } from "../../../drizzle/schema/auth";
import { entitlements } from "../../../drizzle/schema/delivery";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement } from "../../factories/delivery";

describe("Phase 5 Cron Jobs: Subscriptions & Retention (docs/06 §3.3)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("retention.purge_tokens purges expired sessions and verification tokens", async () => {
    await truncateAll();

    const user = await createUser({ emailVerified: true });
    const past = new Date(Date.now() - 10000);
    const future = new Date(Date.now() + 100000);

    // 1 expired session, 1 active session
    await db.insert(sessions).values([
      { userId: user.id, token: "tok-expired", expiresAt: past },
      { userId: user.id, token: "tok-active", expiresAt: future },
    ]);

    // 1 expired token, 1 active token
    await db.insert(verifications).values([
      { identifier: "user@test.com", value: "tok-v-expired", expiresAt: past },
      { identifier: "user@test.com", value: "tok-v-active", expiresAt: future },
    ]);

    const res = await retentionPurgeTokensJob.run();
    expect(res.ok).toBe(true);
    expect(res.detail.purgedSessions).toBe(1);
    expect(res.detail.purgedTokens).toBe(1);

    const remainingSessions = await db.select().from(sessions);
    expect(remainingSessions).toHaveLength(1);
    expect(remainingSessions[0]?.token).toBe("tok-active");
  });

  it("users.anonymise sweeps deleted accounts", async () => {
    await truncateAll();

    const u = await createUser({ emailVerified: true });
    const now = new Date();
    await db.update(users).set({ deletedAt: now }).where(eq(users.id, u.id));

    const res = await usersAnonymiseSweepJob.run(now);
    expect(res.ok).toBe(true);
    expect(res.detail.anonymizedUsers).toBe(1);

    const [anonUser] = await db.select().from(users).where(eq(users.id, u.id));
    expect(anonUser?.anonymizedAt).toBeDefined();
    expect(anonUser?.name).toBe("Deleted User");
    expect(anonUser?.email).toContain("anonymized.codekraft.dev");
  });

  it("entitlements.expire expires one-time entitlements past access_ends_at", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({ productId: product.id, deliveryType: "download" });
    const buyer = await createUser({ emailVerified: true });

    const past = new Date("2026-01-01T00:00:00Z");
    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "download",
      status: "active",
      accessStartsAt: new Date("2025-01-01T00:00:00Z"),
      accessEndsAt: past,
    });

    const res = await entitlementsExpireJob.run(new Date("2026-01-02T00:00:00Z"));
    expect(res.ok).toBe(true);
    expect(res.detail.expired).toBe(1);

    const [entAfter] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(entAfter?.status).toBe("expired");
  });
});
