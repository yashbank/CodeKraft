import { describe, expect, it } from "vitest";

import {
  LANDING_FIELDS,
  landingFieldHelp,
  type LandingChapterKey,
} from "@/components/admin/content/landing-field-help";

const CHAPTERS: LandingChapterKey[] = ["who", "build", "sell", "proof", "talk"];

describe("landingFieldHelp", () => {
  it("labels every field of every chapter with a placement line", () => {
    for (const c of CHAPTERS)
      for (const f of LANDING_FIELDS) expect(landingFieldHelp(c, f).length).toBeGreaterThan(10);
  });
  it("says where every CTA field shows, in every chapter", () => {
    for (const c of CHAPTERS)
      for (const f of ["cta1", "cta1-target", "cta2", "cta2-target"] as const)
        expect(landingFieldHelp(c, f)).not.toMatch(/Not (shown|used)/);
  });
  it("names the section", () => {
    expect(landingFieldHelp("sell", "title")).toBe("Shown as the headline of the 'Sell' section.");
  });
});
