// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, actionResult, stubAll } = vi.hoisted(() => {
  const actionResult = { current: { ok: true, data: {} } as { ok: boolean; data?: unknown } };
  /** Replace every export of an actions module with a stub returning the shared fake result. */
  const stubAll = async (orig: () => Promise<Record<string, unknown>>) => {
    const act = async () => actionResult.current;
    return Object.fromEntries(Object.keys(await orig()).map((k) => [k, act]));
  };
  return { revalidatePath: vi.fn(), actionResult, stubAll };
});
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag: vi.fn() }));
vi.mock("@/lib/authz/admin-request-context", () => ({
  getAdminRequestContext: async () => ({}),
}));
vi.mock("@/modules/content/actions", (orig) => stubAll(orig as never));
vi.mock("@/modules/catalog/actions", (orig) => stubAll(orig as never));
vi.mock("@/modules/blog/actions", (orig) => stubAll(orig as never));

import * as catalog from "@/modules/catalog/admin-mutations";
import * as content from "@/modules/content/admin-mutations";

describe("admin writes revalidate every ISR public page (P15-02)", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
    actionResult.current = { ok: true, data: {} };
  });

  it("content saves revalidate the whole layout tree", async () => {
    await content.saveLandingChapter({});
    await content.saveLegalPage({});
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("catalog saves revalidate the whole layout tree", async () => {
    await catalog.createProduct({});
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("failed writes do not revalidate", async () => {
    actionResult.current = { ok: false };
    await content.saveLandingChapter({});
    await catalog.updateProduct({});
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
