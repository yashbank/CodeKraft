import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { cn, FONT_SIZE_TOKENS } from "@/components/ui/_utils";

describe("cn()", () => {
  it("keeps a custom colour class next to a custom font-size class", () => {
    const out = cn("bg-accent text-accent-fg", "h-10 px-4 text-body");
    expect(out).toContain("text-accent-fg");
    expect(out).toContain("text-body");
  });
  it("still merges conflicting sizes and conflicting colours", () => {
    expect(cn("text-body", "text-body-sm")).toBe("text-body-sm");
    expect(cn("text-fg", "text-accent-fg")).toBe("text-accent-fg");
  });
  it("FONT_SIZE_TOKENS matches the --text-* tokens in tokens.css", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    const names = new Set(
      [...css.matchAll(/^\s*--text-([a-z0-9-]+?)(?:--[a-z-]+)?:/gm)].flatMap((m) =>
        m[1] ? [m[1]] : [],
      ),
    );
    for (const t of FONT_SIZE_TOKENS) expect(names.has(t), t).toBe(true);
    for (const n of names)
      expect((FONT_SIZE_TOKENS as readonly string[]).includes(n), n).toBe(true);
  });
});
