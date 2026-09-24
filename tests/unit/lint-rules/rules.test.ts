import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin from "../../../eslint-rules/index.js";

function lint(rule: string, code: string, filename = "x.ts") {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
          parser: tsParser,
          ecmaVersion: 2022,
          sourceType: "module",
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { codekraft: plugin as any },
        rules: { [`codekraft/${rule}`]: "error" },
      },
    ],
    { filename },
  );
}

describe("codekraft/no-float-money", () => {
  it("rejects float operations", () => {
    const bad = [
      "const a = parseFloat('1.5');",
      "const b = Number(x);",
      "const c = (amount).toFixed(2);",
      "const d = Math.round(x);",
      "const e = 0.5;",
      "const f = a / b;",
    ];
    for (const code of bad) expect(lint("no-float-money", code).length, code).toBeGreaterThan(0);
  });
  it("accepts integer arithmetic", () => {
    const ok = "const a = 100; const b = a + 5; const c = BigInt(a) * 10n; const d = a % 7;";
    expect(lint("no-float-money", ok)).toEqual([]);
  });
});

describe("codekraft/no-edge-runtime", () => {
  it("rejects edge runtime export", () => {
    expect(lint("no-edge-runtime", "export const runtime = 'edge';").length).toBe(1);
  });
  it("accepts nodejs runtime", () => {
    expect(
      lint(
        "no-edge-runtime",
        "export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';",
      ),
    ).toEqual([]);
  });
});

describe("codekraft/no-hardcoded-colors", () => {
  it("rejects colour literals", () => {
    const bad = [
      "const s = { color: '#fff' };",
      "const t = `background: rgb(1,2,3)`;",
      "const u = 'hsl(200 50% 50%)';",
      "const v = 'oklch(0.5 0.1 200)';",
    ];
    for (const code of bad)
      expect(lint("no-hardcoded-colors", code, "c.tsx").length, code).toBeGreaterThan(0);
  });
  it("accepts token references and classes", () => {
    const ok =
      "const s = 'bg-surface text-fg'; const v = 'var(--ck-accent)'; const n = '#1 issue';";
    expect(lint("no-hardcoded-colors", ok, "c.tsx")).toEqual([]);
  });
});
