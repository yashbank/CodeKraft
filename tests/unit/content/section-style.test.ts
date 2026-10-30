import { describe, expect, it } from "vitest";

import { upsertLandingChapterSchema } from "@/modules/content/contracts";
import {
  parseSectionStyle,
  sectionStyleCss,
  sectionStyleSchema,
} from "@/modules/content/section-style";

const base = {
  key: "build",
  title: "T",
  bodyJson: { type: "doc", content: [{ type: "paragraph" }] },
  cta: { primary: { label: "Go", href: "/x" } },
  position: 1,
  published: true,
};

describe("section style schema", () => {
  it("accepts enum values and the empty object", () => {
    expect(sectionStyleSchema.safeParse({}).success).toBe(true);
    expect(
      sectionStyleSchema.safeParse({
        font: "playfair-worksans",
        border: "strong",
        padY: "lg",
        padX: "sm",
        gap: "md",
        tone: "raised",
      }).success,
    ).toBe(true);
  });
  it("rejects raw CSS, unknown fonts, numbers and extra keys", () => {
    for (const bad of [
      { padY: "40px" },
      { padY: 40 },
      { border: "1px solid red" },
      { font: "Comic Sans" },
      { tone: "url(javascript:x)" },
      { color: "red" },
    ])
      expect(sectionStyleSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
  it("is part of the chapter upsert contract (media.style)", () => {
    const ok = upsertLandingChapterSchema.safeParse({ ...base, media: { style: { padY: "lg" } } });
    expect(ok.success).toBe(true);
    const bad = upsertLandingChapterSchema.safeParse({
      ...base,
      media: { style: { padY: "9px" } },
    });
    expect(bad.success).toBe(false);
  });
});

describe("section style to CSS", () => {
  it("missing or default style yields no declarations", () => {
    expect(sectionStyleCss(undefined)).toEqual({});
    expect(sectionStyleCss(null)).toEqual({});
    expect(sectionStyleCss({})).toEqual({});
    expect(sectionStyleCss({ font: "default" })).toEqual({});
  });
  it("maps each control to a declaration", () => {
    const css = sectionStyleCss({
      padY: "lg",
      padX: "md",
      border: "strong",
      gap: "sm",
      tone: "raised",
      font: "playfair-worksans",
    }) as Record<string, string>;
    expect(css.paddingBlock).toBe("7rem");
    expect(css.paddingInline).toBeTruthy();
    expect(css.borderBlock).toContain("var(--ck-color-border-strong)");
    expect(css["--sec-gap"]).toBe("1rem");
    expect(css.backgroundColor).toBe("var(--ck-color-surface)");
    expect(css["--ck-font-display"]).toContain("--font-playfair");
    expect(css.fontFamily).toBe("var(--ck-font-body)");
    expect(sectionStyleCss({ border: "none" }).borderBlock).toBe("0");
  });
  it("parseSectionStyle drops invalid stored values", () => {
    expect(parseSectionStyle({ padY: "lg" })).toEqual({ padY: "lg" });
    expect(parseSectionStyle({ padY: "evil" })).toBeUndefined();
    expect(parseSectionStyle(undefined)).toBeUndefined();
  });
});
