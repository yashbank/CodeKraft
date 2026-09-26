import { describe, expect, it } from "vitest";
import { defaultDeliveryHandlerRegistry } from "@/modules/delivery/handlers";

describe("Delivery Handlers Registry and Behaviors (docs/04 §7.3, MASTER_SPEC §7)", () => {
  it("registers all 6 delivery types", () => {
    const types = defaultDeliveryHandlerRegistry.types();
    expect(types).toContain("download");
    expect(types).toContain("license");
    expect(types).toContain("saas");
    expect(types).toContain("hosted");
    expect(types).toContain("service");
    expect(types).toContain("custom");
  });

  it("fulfilment logic matches per type specification", () => {
    const download = defaultDeliveryHandlerRegistry.get("download");
    const license = defaultDeliveryHandlerRegistry.get("license");
    const saas = defaultDeliveryHandlerRegistry.get("saas");
    const service = defaultDeliveryHandlerRegistry.get("service");

    expect(download.isFulfilled({ status: "active" } as any, [])).toBe(true);
    expect(license.isFulfilled({ licenseKeyEnc: null } as any, [])).toBe(false);
    expect(license.isFulfilled({ licenseKeyEnc: "enc-key" } as any, [])).toBe(true);
    expect(saas.isFulfilled({ provisioningState: "pending" } as any, [])).toBe(false);
    expect(saas.isFulfilled({ provisioningState: "done" } as any, [])).toBe(true);
    expect(service.isFulfilled({} as any, [{ doneAt: null } as any])).toBe(false);
    expect(service.isFulfilled({} as any, [{ doneAt: new Date() } as any])).toBe(true);
  });
});
