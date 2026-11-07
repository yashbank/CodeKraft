import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildContext } from "@/lib/authz/context";
import { settingsService } from "@/modules/settings/service";
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

describe("settings save invalidates caches only after COMMIT", () => {
  const sql = getTestDb();
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("revalidates the settings tag after the transaction commits, never inside it", async () => {
    await truncateAll(sql);
    const admin = await createUser({ role: "super_admin" });
    const ctx = buildContext({
      user: { id: admin.id },
      session: { id: "s" },
      roles: ["super_admin"],
    });
    events.length = 0;
    await settingsService.updateSettings(ctx, { patch: { siteName: "Committed Name" } });
    const commit = events.indexOf("commit");
    expect(commit).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("revalidate:settings")).toBeGreaterThan(commit);
    expect(events.lastIndexOf("revalidate:content")).toBeGreaterThan(commit);
    expect(events.slice(0, commit)).toEqual([]);
  });
});
