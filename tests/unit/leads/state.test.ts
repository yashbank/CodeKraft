import { describe, expect, it } from "vitest";
import { assertValidLeadStatusTransition, canTransitionLeadStatus } from "@/modules/leads/state";

describe("Leads Unit: State Transitions", () => {
  it("allows forward pipeline progression", () => {
    expect(canTransitionLeadStatus("new", "contacted")).toBe(true);
    expect(canTransitionLeadStatus("contacted", "qualified")).toBe(true);
    expect(canTransitionLeadStatus("qualified", "proposal")).toBe(true);
    expect(canTransitionLeadStatus("proposal", "won")).toBe(true);
  });

  it("requires lostReason when transitioning to lost", () => {
    expect(() => assertValidLeadStatusTransition("new", "lost", "")).toThrowError(/lostReason is required/);
    expect(() => assertValidLeadStatusTransition("new", "lost", "Client budget too low")).not.toThrow();
  });

  it("allows reopening lost leads to new", () => {
    expect(canTransitionLeadStatus("lost", "new")).toBe(true);
    expect(() => assertValidLeadStatusTransition("lost", "new")).not.toThrow();
  });

  it("disallows invalid backward transitions", () => {
    expect(canTransitionLeadStatus("won", "new")).toBe(false);
    expect(canTransitionLeadStatus("won", "contacted")).toBe(false);
    expect(() => assertValidLeadStatusTransition("won", "new")).toThrowError(/Invalid lead status transition/);
  });
});
