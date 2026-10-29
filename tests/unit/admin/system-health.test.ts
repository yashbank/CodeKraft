// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { runHealthChecks, type HealthDeps } from "@/lib/admin/system-health";

const NOW = new Date("2026-10-29T12:00:00Z");
const okEnv = { EMAIL_TRANSPORT: "resend", EMAIL_FROM: "a@codekraft.in", RESEND_API_KEY: "k" };

function deps(over: Partial<HealthDeps> = {}): HealthDeps {
  return {
    query: vi.fn(async (q) => {
      const text = JSON.stringify(q);
      if (text.includes("max(started_at)")) return [{ last: new Date(NOW.getTime() - 600_000) }];
      if (text.includes("razorpay_settings"))
        return [{ mode: "test", has_id: true, has_secret: true }];
      if (text.includes("__drizzle_migrations")) return [{ n: 9 }];
      if (text.includes("order by updated_at")) return [];
      if (text.includes("last_error")) return [{ jobs: 0, emails: 0 }];
      return [{ "?column?": 1 }];
    }),
    headProbe: async () => ({}),
    env: okEnv as HealthDeps["env"],
    now: () => NOW,
    timeoutMs: 50,
    expectedMigrations: 9,
    ...over,
  };
}
const by = (r: Awaited<ReturnType<typeof runHealthChecks>>, l: string) =>
  r.find((h) => h.label === l)!;

describe("runHealthChecks", () => {
  it("all ok: seven checks, each with status + checkedAt", async () => {
    const r = await runHealthChecks(deps());
    expect(r.map((h) => h.label)).toEqual([
      "Database",
      "Storage",
      "Email",
      "Payments",
      "Cron",
      "Recent errors",
      "Migrations",
    ]);
    for (const h of r) {
      expect(h.status).toBe("ok");
      expect(h.ok).toBe(true);
      expect(h.checkedAt).toBe(NOW.toISOString());
    }
  });

  it("db failure is fail, others still reported", async () => {
    const query = vi.fn().mockRejectedValue(new Error("conn refused"));
    const r = await runHealthChecks(deps({ query }));
    expect(by(r, "Database")).toMatchObject({ status: "fail", ok: false, detail: "conn refused" });
    expect(by(r, "Storage").status).toBe("ok");
    expect(by(r, "Email").status).toBe("ok");
    expect(r).toHaveLength(7);
  });

  it("storage: not-found proves reachability, other errors and timeouts fail", async () => {
    const nf = Object.assign(new Error("x"), { name: "NotFound" });
    expect(
      by(await runHealthChecks(deps({ headProbe: async () => Promise.reject(nf) })), "Storage")
        .status,
    ).toBe("ok");
    const denied = await runHealthChecks(
      deps({ headProbe: async () => Promise.reject(new Error("AccessDenied")) }),
    );
    expect(by(denied, "Storage").status).toBe("fail");
    const hang = await runHealthChecks(deps({ headProbe: () => new Promise(() => {}) }));
    expect(by(hang, "Storage")).toMatchObject({ status: "fail", detail: "timed out after 50 ms" });
  });

  it("email warns when sender is not deliverable", async () => {
    const env = { ...okEnv, EMAIL_TRANSPORT: "log" } as HealthDeps["env"];
    expect(by(await runHealthChecks(deps({ env })), "Email").status).toBe("warn");
  });

  it("email names the transport and the last outbox failure", async () => {
    const query = vi.fn(async (q) =>
      JSON.stringify(q).includes("order by updated_at")
        ? [{ last_error: "550 bounced", updated_at: NOW }]
        : [{ n: 1 }],
    );
    expect(by(await runHealthChecks(deps({ query })), "Email")).toMatchObject({
      status: "warn",
      detail: "resend · last failure: 550 bounced",
    });
  });

  it("payments: reports mode and key presence, never the keys", async () => {
    expect(by(await runHealthChecks(deps()), "Payments").detail).toBe(
      "Razorpay test mode, keys set",
    );
    const none = deps({ query: vi.fn(async () => []) });
    expect(by(await runHealthChecks(none), "Payments")).toMatchObject({
      status: "warn",
      detail: "Razorpay not configured",
    });
  });

  it("migrations: warns when the database is behind the repo", async () => {
    const r = await runHealthChecks(deps({ expectedMigrations: 10 }));
    expect(by(r, "Migrations")).toMatchObject({
      status: "warn",
      detail: "1 pending (9 of 10 applied)",
    });
  });

  it("cron: warns when no runs or stale", async () => {
    const none = deps({ query: vi.fn(async () => [{ last: null }]) });
    expect(by(await runHealthChecks(none), "Cron").detail).toBe("no runs yet");
    const stale = deps({
      query: vi.fn(async () => [{ last: new Date(NOW.getTime() - 48 * 3_600_000) }]),
    });
    expect(by(await runHealthChecks(stale), "Cron")).toMatchObject({
      status: "warn",
      detail: "last run 48 h ago",
    });
  });

  it("recent errors warns with counts", async () => {
    const query = vi.fn(async (q) =>
      JSON.stringify(q).includes("last_error") ? [{ jobs: "2", emails: "1" }] : [{ last: NOW }],
    );
    expect(by(await runHealthChecks(deps({ query })), "Recent errors")).toMatchObject({
      status: "warn",
      detail: "2 failed jobs, 1 email errors (24 h)",
    });
  });

  it("never returns an empty list even if every check fails", async () => {
    const r = await runHealthChecks(
      deps({
        query: vi.fn().mockRejectedValue(new Error("down")),
        headProbe: async () => Promise.reject(new Error("down")),
        env: {} as HealthDeps["env"],
      }),
    );
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((h) => h.checkedAt)).toBe(true);
  });
});
