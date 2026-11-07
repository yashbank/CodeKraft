import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/cache", () => ({ revalidateTag: (tag: string) => revalidateTag(tag) }));
vi.mock("next/server", () => ({ after: (cb: () => unknown) => afterCallbacks.push(cb) }));

import { revalidateSettingsCaches } from "@/modules/settings/service";

describe("revalidateSettingsCaches", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    revalidateTag.mockClear();
    afterCallbacks.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("drops settings + content now, and again after the in-flight ISR renders have settled", async () => {
    await revalidateSettingsCaches();
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(["settings", "content"]);

    // A render that read the pre-commit settings and finishes after the first invalidation
    // re-caches them as fresh (twin /ssg pages, 300 s): the follow-up drops that entry.
    expect(afterCallbacks).toHaveLength(1);
    revalidateTag.mockClear();
    const done = Promise.resolve(afterCallbacks[0]!());
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(["settings", "content"]);
  });

  it("does not throw outside a request (after() unavailable)", async () => {
    vi.resetModules();
    vi.doMock("next/server", () => ({
      after: () => {
        throw new Error("`after` was called outside a request scope");
      },
    }));
    const mod = await import("@/modules/settings/service");
    await expect(mod.revalidateSettingsCaches()).resolves.toBeUndefined();
  });
});
