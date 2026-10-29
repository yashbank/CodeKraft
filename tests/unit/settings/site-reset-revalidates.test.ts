import { describe, expect, it, vi } from "vitest";

const tags = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/revalidate", () => ({
  revalidateTagsSafe: (t: readonly string[]) => void tags.push(...t),
  revalidatePathSafe: () => undefined,
}));
vi.mock("@/modules/settings/site-reset", () => ({
  resetDbFrom: (tx: unknown) => tx,
  runReset: async () => [],
}));
vi.mock("@/modules/audit/service", () => ({ auditService: { log: async () => undefined } }));

import { approvalsService } from "@/modules/approvals/service";
import "@/modules/settings/site-reset-handler";

describe("site.reset apply handler", () => {
  it("drops the cached brand/theme/catalog data after the wipe", async () => {
    const handler = approvalsService.getApplyHandler("site.reset");
    expect(handler).toBeTypeOf("function");
    await handler!(
      { requestId: "r", decidedBy: "u", subject: { type: "site", id: "site" } } as never,
      { categories: ["leads"] } as never,
      {} as never,
    );
    expect(tags).toEqual(expect.arrayContaining(["settings", "content", "catalog"]));
  });
});
