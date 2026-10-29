// @vitest-environment node
import { describe, expect, it } from "vitest";
import { setFollowUpSchema } from "@/modules/leads/types";
import { DefaultLeadsService } from "@/modules/leads/service";
import type { RequestContext } from "@/lib/authz/context";

const LEAD = "33333333-3333-4333-8333-333333333333";

function fakeDb() {
  const sets: Record<string, unknown>[] = [];
  const acts: Record<string, unknown>[] = [];
  const db = {
    update: () => ({
      set: (v: Record<string, unknown>) => {
        sets.push(v);
        return {
          where: () => ({
            returning: async () => [{ id: LEAD, priority: v.priority, status: "new" }],
          }),
        };
      },
    }),
    insert: () => ({
      values: async (v: Record<string, unknown>) => void acts.push(v),
    }),
  };
  return { db, sets, acts };
}

describe("bulk Set priority (setFollowUp without a follow-up date)", () => {
  it("accepts a priority-only payload", () => {
    expect(setFollowUpSchema.safeParse({ leadId: LEAD, priority: "high" }).success).toBe(true);
  });

  it("leaves next_follow_up_at untouched and logs a priority activity", async () => {
    const { db, sets, acts } = fakeDb();
    const svc = new DefaultLeadsService(db as never);
    // toLeadRow needs a full row; only the write side matters here.
    (svc as unknown as { toLeadRow: (r: unknown) => unknown }).toLeadRow = (r) => r;
    await svc.setFollowUp({ userId: "u" } as RequestContext, { leadId: LEAD, priority: "high" });
    expect(sets[0]).not.toHaveProperty("nextFollowUpAt");
    expect(sets[0]).toMatchObject({ priority: "high" });
    expect(String(acts[0]?.body)).toBe("Priority set to high");
  });

  it("still clears the follow-up when null is passed explicitly", async () => {
    const { db, sets } = fakeDb();
    const svc = new DefaultLeadsService(db as never);
    (svc as unknown as { toLeadRow: (r: unknown) => unknown }).toLeadRow = (r) => r;
    await svc.setFollowUp({ userId: "u" } as RequestContext, {
      leadId: LEAD,
      nextFollowUpAt: null,
    });
    expect(sets[0]).toHaveProperty("nextFollowUpAt", null);
  });
});
