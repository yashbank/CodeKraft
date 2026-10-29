import { describe, expect, it } from "vitest";
import { defaultDeliveryHandlerRegistry as registry } from "@/modules/delivery/handlers";
import type { DeliveryHandlerContext } from "@/modules/delivery/handler";
import type { TxCtx } from "@/lib/db";

process.env.APP_ENCRYPTION_KEY ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** Fake tx: records `update().set()` values and returns a task id for `insert().returning()`. */
function fakeTx() {
  const sets: Array<Record<string, unknown>> = [];
  const tx = {
    insert: () => ({ values: () => ({ returning: async () => [{ id: "task-1" }] }) }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        sets.push(v);
        return { where: async () => undefined };
      },
    }),
  } as unknown as TxCtx;
  return { tx, sets };
}
const ctx = (provisioning: "manual" | "automated" = "manual") =>
  ({ offering: { deliveryConfig: { provisioning } } }) as unknown as DeliveryHandlerContext;
const ent = (o: Record<string, unknown>) => ({ id: "e1", ...o }) as never;

describe("R9-03 paid -> fulfilled, per delivery type", () => {
  it("download: active on grant, fulfilled immediately, no admin step", async () => {
    const h = registry.get("download");
    const out = await h.onGranted(ctx(), ent({}), fakeTx().tx);
    expect(out).toMatchObject({ status: "active", taskIds: [] });
    expect(h.isFulfilled(ent({ status: out.status }), [])).toBe(true);
  });

  it("license (automated): key issued on grant -> fulfilled", async () => {
    const { tx, sets } = fakeTx();
    const h = registry.get("license");
    const out = await h.onGranted(ctx("automated"), ent({}), tx);
    expect(out).toMatchObject({ status: "active", provisioningState: "done", taskIds: [] });
    expect(h.isFulfilled(ent({ licenseKeyEnc: sets[0]?.licenseKeyEnc }), [])).toBe(true);
  });

  it("license (manual): open task, not fulfilled until the admin sets the key", async () => {
    const h = registry.get("license");
    const out = await h.onGranted(ctx("manual"), ent({}), fakeTx().tx);
    expect(out).toMatchObject({
      status: "active",
      provisioningState: "pending",
      taskIds: ["task-1"],
    });
    expect(h.isFulfilled(ent({ licenseKeyEnc: null }), [])).toBe(false);
    expect(h.isFulfilled(ent({ licenseKeyEnc: "enc" }), [])).toBe(true);
  });

  it("saas: active but unfulfilled until provisioning is done", async () => {
    const h = registry.get("saas");
    const out = await h.onGranted(ctx(), ent({}), fakeTx().tx);
    expect(out).toMatchObject({ status: "active", provisioningState: "pending" });
    expect(h.isFulfilled(ent({ provisioningState: out.provisioningState }), [])).toBe(false);
    expect(h.isFulfilled(ent({ provisioningState: "done" }), [])).toBe(true);
  });

  it("hosted: pending until the admin provisions it", async () => {
    const h = registry.get("hosted");
    const out = await h.onGranted(ctx(), ent({}), fakeTx().tx);
    expect(out).toMatchObject({ status: "pending", provisioningState: "pending" });
    expect(h.isFulfilled(ent({ provisioningState: "pending" }), [])).toBe(false);
    expect(h.isFulfilled(ent({ provisioningState: "done", status: "active" }), [])).toBe(true);
  });

  it("service: fulfilled only when every step is done", () => {
    const h = registry.get("service");
    expect(h.isFulfilled(ent({}), [{ doneAt: new Date() }, { doneAt: null }] as never)).toBe(false);
    expect(h.isFulfilled(ent({}), [{ doneAt: new Date() }] as never)).toBe(true);
  });

  // Failing-first: custom used to be active/n-a on grant, so the order read "fulfilled" at payment
  // with nothing delivered and no task for the admin.
  it("custom: waits for the admin (pending + open task), then fulfilled when delivered", async () => {
    const h = registry.get("custom");
    const out = await h.onGranted(ctx(), ent({}), fakeTx().tx);
    expect(out).toMatchObject({
      status: "pending",
      provisioningState: "pending",
      taskIds: ["task-1"],
    });
    const waiting = ent({ status: out.status, provisioningState: out.provisioningState });
    expect(h.isFulfilled(waiting, [])).toBe(false);
    expect(h.isFulfilled(ent({ status: "active", provisioningState: "done" }), [])).toBe(true);
    // legacy rows granted before this change must not stay stuck
    expect(h.isFulfilled(ent({ status: "active", provisioningState: "n/a" }), [])).toBe(true);
    expect(h.adminActions(waiting, [])[0]).toMatchObject({
      key: "complete_provisioning",
      enabled: true,
    });
  });
});
