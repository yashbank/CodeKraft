import { beforeAll, describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createSuperAdmin } from "../../factories/users";
import { fxRefreshJob } from "@/jobs/fx";
import { fxService } from "@/modules/fx/service";
import { fxRates } from "../../../drizzle/schema/settings";
import { jobRuns } from "../../../drizzle/schema/ops";
import { notifications } from "../../../drizzle/schema/notifications";
import { and, desc, eq } from "drizzle-orm";
import { toFactoryDb } from "../../factories/context";

describe("FX Refresh Job & Lifecycle (PHASE-03 P3.12, docs/06 §3.3, TM-13)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("fetches and upserts rates for INR ↔ {USD, EUR, GBP, CAD} and records job_run", async () => {
    await truncateAll();
    const drizzleDb = toFactoryDb();

    const mockRates = {
      USD: "0.01200000",
      EUR: "0.01100000",
      GBP: "0.00950000",
      CAD: "0.01630000",
    };

    const asOf = "2026-09-26";
    const result = await fxRefreshJob.run(new Date("2026-09-26T03:00:00Z"), {
      asOf,
      mockRates,
    });

    expect(result.asOf).toBe(asOf);
    expect(result.written).toBe(8); // 4 pairs in both directions
    expect(result.error).toBeUndefined();
    expect(result.stale).toBe(false);

    // Verify rows in fx_rates
    const rows = await drizzleDb.select().from(fxRates);
    expect(rows).toHaveLength(8);

    const usdRow = rows.find((r) => r.base === "INR" && r.quote === "USD");
    expect(usdRow).toBeDefined();
    expect(usdRow?.rate).toBe("0.01200000");
    expect(usdRow?.source).toBe("open.er-api.com");

    const inrRow = rows.find((r) => r.base === "USD" && r.quote === "INR");
    expect(inrRow).toBeDefined();
    expect(inrRow?.rate).toBe("83.33333333");

    // Verify job_runs record
    const [run] = await drizzleDb.select().from(jobRuns).where(eq(jobRuns.job, "fx.refresh"));
    expect(run).toBeDefined();
    expect(run?.status).toBe("ok");
  });

  it("is idempotent on same day", async () => {
    await truncateAll();
    const drizzleDb = toFactoryDb();

    const mockRates = {
      USD: "0.01200000",
      EUR: "0.01100000",
      GBP: "0.00950000",
      CAD: "0.01630000",
    };

    const asOf = "2026-09-26";
    await fxRefreshJob.run(new Date("2026-09-26T03:00:00Z"), { asOf, mockRates });
    const res2 = await fxRefreshJob.run(new Date("2026-09-26T12:00:00Z"), {
      asOf,
      mockRates,
    });

    expect(res2.written).toBe(8);
    const rows = await drizzleDb.select().from(fxRates);
    expect(rows).toHaveLength(8); // Still 8 rows, no duplicates
  });

  it("admin manual override takes precedence over refresh for that date", async () => {
    await truncateAll();
    const drizzleDb = toFactoryDb();
    const admin = await createSuperAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-fx-adm" },
      roles: ["super_admin"],
    });

    const asOf = "2026-09-26";

    // Set manual override for USD
    await fxService.setFxOverride(adminCtx, {
      quote: "USD",
      rate: "0.01500000",
      asOf,
    });

    // Run daily refresh
    const mockRates = {
      USD: "0.01200000",
      EUR: "0.01100000",
      GBP: "0.00950000",
      CAD: "0.01630000",
    };
    await fxRefreshJob.run(new Date("2026-09-26T03:00:00Z"), { asOf, mockRates });

    // Verify USD rate remains the manual override
    const [usdRow] = await drizzleDb
      .select()
      .from(fxRates)
      .where(and(eq(fxRates.base, "INR"), eq(fxRates.quote, "USD"), eq(fxRates.asOf, asOf)));
    expect(usdRow?.rate).toBe("0.01500000");
    expect(usdRow?.source).toBe("manual");

    // Other currencies updated from open.er-api.com
    const [eurRow] = await drizzleDb
      .select()
      .from(fxRates)
      .where(and(eq(fxRates.base, "INR"), eq(fxRates.quote, "EUR"), eq(fxRates.asOf, asOf)));
    expect(eurRow?.rate).toBe("0.01100000");
    expect(eurRow?.source).toBe("open.er-api.com");
  });

  it("rejects poisoned rate outside ±20% bounds (TM-13) and keeps previous rate", async () => {
    await truncateAll();
    const drizzleDb = toFactoryDb();

    // Day 1: normal rates
    await fxRefreshJob.run(new Date("2026-09-25T03:00:00Z"), {
      asOf: "2026-09-25",
      mockRates: {
        USD: "0.01200000",
        EUR: "0.01100000",
        GBP: "0.00950000",
        CAD: "0.01630000",
      },
    });

    // Day 2: USD is poisoned (+66%: 0.02000000)
    const res2 = await fxRefreshJob.run(new Date("2026-09-26T03:00:00Z"), {
      asOf: "2026-09-26",
      mockRates: {
        USD: "0.02000000", // Poisoned!
        EUR: "0.01120000", // Normal (+1.8%)
        GBP: "0.00960000", // Normal (+1.0%)
        CAD: "0.01640000", // Normal (+0.6%)
      },
    });

    expect(res2.error).toContain("exceeds ±20% sanity bound");

    // USD for 2026-09-26 was NOT written
    const [poisonedUsd] = await drizzleDb
      .select()
      .from(fxRates)
      .where(
        and(eq(fxRates.base, "INR"), eq(fxRates.quote, "USD"), eq(fxRates.asOf, "2026-09-26")),
      );
    expect(poisonedUsd).toBeUndefined();

    // EUR for 2026-09-26 WAS written
    const [eurRow] = await drizzleDb
      .select()
      .from(fxRates)
      .where(
        and(eq(fxRates.base, "INR"), eq(fxRates.quote, "EUR"), eq(fxRates.asOf, "2026-09-26")),
      );
    expect(eurRow?.rate).toBe("0.01120000");

    // Job run recorded as error
    const [latestRun] = await drizzleDb
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.job, "fx.refresh"))
      .orderBy(desc(jobRuns.startedAt));
    expect(latestRun?.status).toBe("error");
  });

  it("detects stale rates (> 3 days) and notifies admins once per day", async () => {
    await truncateAll();
    const drizzleDb = toFactoryDb();
    const admin = await createAdmin();

    // Insert rate from 5 days ago
    await drizzleDb.insert(fxRates).values({
      base: "INR",
      quote: "USD",
      rate: "0.01200000",
      asOf: "2026-09-20",
      source: "open.er-api.com",
    });

    const now = new Date("2026-09-26T10:00:00Z");

    // Provider fails (no rates returned)
    const result = await fxRefreshJob.run(now, {
      mockRates: {},
    });

    expect(result.stale).toBe(true);

    // Admin should have received a notification
    const adminNotifications = await drizzleDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, admin.id), eq(notifications.type, "system.fx_stale")));
    expect(adminNotifications).toHaveLength(1);

    // Running again today should NOT duplicate the notification (deduplication)
    await fxRefreshJob.run(now, { mockRates: {} });

    const notifsAfter = await drizzleDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, admin.id), eq(notifications.type, "system.fx_stale")));
    expect(notifsAfter).toHaveLength(1); // Still 1, deduplicated
  });
});
