import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { analyticsService } from "@/modules/analytics/service";
import { createUser } from "../../factories/users";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { analyticsEvents } from "../../../drizzle/schema/ops";
import { eq } from "drizzle-orm";

describe("Analytics Integration (P6.8)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("records client-allowed analytics events and blocks server-only events from client", async () => {
    const user = await createUser({ email: "analytics-user@test.com" });

    // Client allowed: page_view
    const res = await analyticsService.trackEvent(
      { userId: user.id, roles: ["customer"] } as any,
      {
        name: "page_view",
        props: { path: "/products" },
      },
    );
    expect(res.eventId).toBeDefined();

    // Client blocked from server-only event: payment_confirmed -> FORBIDDEN
    await expect(
      analyticsService.trackEvent(
        { userId: user.id, roles: ["customer"] } as any,
        {
          name: "payment_confirmed" as any,
          props: { amount: 5000 },
        },
      ),
    ).rejects.toThrowError(/server-only event/);
  });

  it("records web vitals without user identifiers", async () => {
    const res = await analyticsService.trackWebVital(
      { userId: null, roles: [] } as any,
      {
        metric: "LCP",
        value: 1200,
        rating: "good",
        route: "/products/[slug]",
      },
    );
    expect(res.eventId).toBeDefined();

    const db = getDb();
    const event = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.id, res.eventId))
      .limit(1);

    expect(event[0].name).toBe("web_vital");
    expect(event[0].userId).toBeNull();
  });

  it("returns system health widget data", async () => {
    const health = await analyticsService.getSystemHealthWidget(
      { userId: "admin", roles: ["admin"] } as any,
    );

    expect(health.emailOutbox).toBeDefined();
    expect(health.chatUsage).toBeDefined();
    expect(health.chatUsage.platformCap).toBe(500);
  });
});
