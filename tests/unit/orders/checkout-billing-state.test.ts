import { describe, expect, it } from "vitest";
import { createOrderInput, toBillingSnapshot } from "@/modules/orders/types";

const base = {
  offeringId: "6f9619ff-8b86-4011-b42d-00c04fc964ff",
  paymentMethod: "manual_upi",
};
const parse = (billing: object) => createOrderInput.safeParse({ ...base, billing });

describe("checkout billing state (D17-05)", () => {
  it("rejects an Indian buyer with no state, on the state field", () => {
    const r = parse({ name: "A", email: "a@b.co", country: "IN" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["billing", "stateCode"]);
  });
  it("rejects an unknown state code", () => {
    expect(parse({ name: "A", email: "a@b.co", country: "IN", stateCode: "99" }).success).toBe(
      false,
    );
  });
  it("accepts a foreign buyer without a state and drops a stray one from the snapshot", () => {
    expect(parse({ name: "A", email: "a@b.co", country: "US" }).success).toBe(true);
    const b = { name: "A", email: "a@b.co", country: "US", stateCode: "29" };
    expect(toBillingSnapshot(b).state_code).toBeNull();
  });
  it("stores the Indian state in the snapshot", () => {
    const b = { name: "A", email: "a@b.co", country: "IN", stateCode: "29" };
    expect(toBillingSnapshot(b).state_code).toBe("29");
  });
});
