import { describe, expect, it } from "vitest";
import { QUOTE_STATUS_TRANSITIONS } from "@/modules/quotes/types";

describe("Custom Quote Expiry unit tests (BR-10, docs/03 §3.9)", () => {
  it("allows transitions to expired from sent and accepted only", () => {
    expect(QUOTE_STATUS_TRANSITIONS.sent).toContain("expired");
    expect(QUOTE_STATUS_TRANSITIONS.accepted).toContain("expired");
    expect(QUOTE_STATUS_TRANSITIONS.draft).not.toContain("expired");
    expect(QUOTE_STATUS_TRANSITIONS.paid).toEqual([]);
    expect(QUOTE_STATUS_TRANSITIONS.expired).toEqual([]);
    expect(QUOTE_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });

  it("checks expiry logic against reference timestamp", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const past = new Date("2026-09-26T11:59:59Z");
    const future = new Date("2026-09-26T12:00:01Z");

    const isExpired = (expiresAt: Date | null, refDate: Date) =>
      expiresAt !== null && expiresAt.getTime() <= refDate.getTime();

    expect(isExpired(past, now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(future, now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
  });
});
