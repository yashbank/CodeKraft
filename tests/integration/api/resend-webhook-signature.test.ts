import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { signSvix } from "@/lib/svix-verify";
import { customerProfiles } from "../../../drizzle/schema/users-ext";
import { emailOutbox } from "../../../drizzle/schema/notifications";
import { webhookEvents } from "../../../drizzle/schema/ops";
import { createUser } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";

const SECRET = `whsec_${Buffer.from("resend-test-secret-0123456789").toString("base64")}`;
const env = process.env as Record<string, string | undefined>;
const savedEnv = {
  RESEND_WEBHOOK_SECRET: env.RESEND_WEBHOOK_SECRET,
  NODE_ENV: env.NODE_ENV,
  EMAIL_TRANSPORT: env.EMAIL_TRANSPORT,
};

const EMAIL = "bouncer@example.com";

async function seed() {
  const { db } = await import("@/lib/db");
  const user = await createUser({ email: EMAIL });
  await db.insert(customerProfiles).values({ userId: user.id }).onConflictDoNothing();
  await db.insert(emailOutbox).values({ toEmail: EMAIL, template: "t", status: "sent" });
  return db;
}

function body(id = "evt_1", type = "email.bounced") {
  return JSON.stringify({ id, type, data: { to: [EMAIL] } });
}

async function post(raw: string, headers: Record<string, string>) {
  const { POST } = await import("@/app/api/webhooks/resend/route");
  return POST(
    new Request("http://localhost/api/webhooks/resend", { method: "POST", body: raw, headers }),
  );
}

async function effects() {
  const { db } = await import("@/lib/db");
  const [profile] = await db.select().from(customerProfiles);
  const [outbox] = await db.select().from(emailOutbox);
  const events = await db.select().from(webhookEvents).where(eq(webhookEvents.provider, "resend"));
  return { prefs: profile?.notificationPrefs, status: outbox?.status, events: events.length };
}

describe("POST /api/webhooks/resend signature (SEC p19-4 #1)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
    env.RESEND_WEBHOOK_SECRET = SECRET;
    env.NODE_ENV = "test";
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) Reflect.deleteProperty(env, k);
      else env[k] = v;
    }
  });

  it("accepts a valid signature and applies the effects", async () => {
    await seed();
    const raw = body();
    const res = await post(raw, signSvix(SECRET, "msg_1", Math.floor(Date.now() / 1000), raw));
    expect(res.status).toBe(200);
    const e = await effects();
    expect(e.prefs).toMatchObject({ email: false });
    expect(e.status).toBe("failed");
    expect(e.events).toBe(1);
  });

  it.each([
    ["missing headers", () => ({})],
    [
      "wrong signature",
      () => ({ ...signSvix(SECRET, "msg_1", Math.floor(Date.now() / 1000), "other") }),
    ],
    [
      "signed with another secret",
      () =>
        signSvix(
          `whsec_${Buffer.from("different").toString("base64")}`,
          "msg_1",
          Math.floor(Date.now() / 1000),
          body(),
        ),
    ],
    [
      "older than 5 minutes",
      () => signSvix(SECRET, "msg_1", Math.floor(Date.now() / 1000) - 400, body()),
    ],
  ])("rejects %s with 401 and no effects", async (_n, mk) => {
    await seed();
    const res = await post(body(), mk());
    expect(res.status).toBe(401);
    const e = await effects();
    expect(e.prefs).toMatchObject({ email: true });
    expect(e.status).toBe("sent");
    expect(e.events).toBe(0);
  });

  it("fails closed (503) in production when the secret is unset", async () => {
    await seed();
    delete env.RESEND_WEBHOOK_SECRET;
    env.NODE_ENV = "production";
    env.EMAIL_TRANSPORT = "resend";
    const res = await post(body(), {});
    expect(res.status).toBe(503);
    expect((await effects()).status).toBe("sent");
  });

  it("stays open in test/dev when the secret is unset", async () => {
    await seed();
    delete env.RESEND_WEBHOOK_SECRET;
    const res = await post(body(), {});
    expect(res.status).toBe(200);
    expect((await effects()).status).toBe("failed");
  });
});
