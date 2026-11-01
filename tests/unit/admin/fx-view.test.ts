import { describe, expect, it } from "vitest";
import { viewerFxRows, type InrFxRow } from "@/lib/admin/fx-view";

const m = { asOf: "2026-11-01", source: "t", fetchedAt: "2026-11-01T00:00:00Z", stale: false };
const rows = [
  { quote: "USD", rate: "0.0120", ...m },
  { quote: "GBP", rate: "0.0100", ...m },
] as InrFxRow[];

describe("viewerFxRows", () => {
  it("INR viewer is unchanged", () => {
    expect(viewerFxRows(rows, "INR")).toBe(rows);
  });
  it("GBP viewer: 1 GBP = 100 INR, 1.2 USD, no GBP row", () => {
    const out = viewerFxRows(rows, "GBP");
    expect(out.map((r) => [r.quote, Number(r.rate)])).toEqual([
      ["INR", 100],
      ["USD", 1.2],
    ]);
  });
});
