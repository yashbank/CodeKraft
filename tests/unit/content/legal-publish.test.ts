import { describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath }));
vi.mock("@/modules/search/indexer", () => ({ triggerReindexSafe: vi.fn() }));

import { buildContext } from "@/lib/authz/context";
import { createContentService } from "@/modules/content/service";

const doc = (t: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
});

/** Minimal in-memory drizzle stand-in: one legal page row + snapshots. */
function fakeDb() {
  const row: Record<string, unknown> = {
    id: "p1",
    key: "terms",
    title: "Terms",
    bodyJson: doc("old"),
    version: 1,
    publishedAt: null,
  };
  const versions: Record<string, unknown>[] = [];
  const chain = (result: () => unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "set", "values", "orderBy"]) c[m] = () => c;
    c.returning = () => Promise.resolve(result());
    c.then = (r: (v: unknown) => unknown) => Promise.resolve(result()).then(r);
    return c;
  };
  let patch: Record<string, unknown> = {};
  return {
    row,
    select: () => chain(() => [row]),
    update: () => {
      const c = chain(() => [Object.assign(row, patch)]);
      c.set = (v: Record<string, unknown>) => ((patch = v), c);
      return c;
    },
    insert: () => {
      const c = chain(() => [versions[versions.length - 1]]);
      c.values = (v: Record<string, unknown>) => (versions.push(v), c);
      return c;
    },
  };
}

describe("legal save -> publish", () => {
  it("publishes the saved draft as a snapshot and revalidates the public path", async () => {
    const db = fakeDb();
    const svc = createContentService(() => db as never);
    const ctx = buildContext({
      user: { id: "u1" },
      session: { id: "s1" },
      roles: ["super_admin"],
    });

    await svc.updateLegalPage(ctx, {
      key: "terms",
      title: "Terms v2",
      bodyJson: doc("new") as never,
    });
    expect(db.row.title).toBe("Terms v2");
    expect(db.row.publishedAt).toBeNull();

    const { page, version } = await svc.publishLegalPage(ctx, { key: "terms" });
    expect(page.publishedAt).toBeInstanceOf(Date);
    expect(version.bodyJson).toEqual(doc("new"));
    expect(revalidatePath).toHaveBeenCalledWith("/legal/terms");
  });
});
