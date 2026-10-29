/**
 * R9-05 guard: no "for testing" / "tester" / "dev only" copy may ship in user-visible src strings.
 * Only string literals and JSX text are scanned (comments are not part of the AST), and the
 * real dev-only routes under src/app/dev are excluded.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../../src");
const DEV_ROUTES = path.join(SRC, "app", "dev");

const PATTERNS: RegExp[] = [
  /testing only/i,
  /for testing/i,
  /\btester/i,
  /\btest only\b/i,
  /\btest-only\b/i,
  /testing purposes/i,
  /\breport (this )?to\b/i,
  /\bdev only\b/i,
  /\btest mode only\b/i,
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return full === DEV_ROUTES ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts") ? [full] : [];
  });
}

/** Every string literal and JSX text node in a file, with its line number. */
function userVisibleStrings(file: string): { line: number; text: string }[] {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: { line: number; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      out.push({ line, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("no tester / test-only copy in shipped UI strings", () => {
  it("finds no PATTERNS hit in src string literals or JSX text (outside src/app/dev)", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const { line, text } of userVisibleStrings(file)) {
        if (PATTERNS.some((p) => p.test(text))) {
          hits.push(`${path.relative(SRC, file)}:${line}: ${text.trim().slice(0, 120)}`);
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
