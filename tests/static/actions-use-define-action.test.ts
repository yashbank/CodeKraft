/**
 * SA-07 — every Server Action is created through `defineAction` / `definePublicAction`
 * (docs/06 §1.3 Zod-first, §1.4 envelope, docs/09 §4.2 permission after parse).
 *
 * Scans `src/modules/<module>/actions.ts` with the TypeScript AST: an exported function
 * declaration, an exported `const` whose initializer is not a `defineAction(...)` /
 * `definePublicAction(...)` call, a default export, a class, or a re-export from another file
 * is a violation. Empty files (`export {}`) pass. The fixtures under `tests/static/fixtures/`
 * prove the scanner both accepts wrapped actions and rejects raw ones.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MODULES_DIR = path.join(ROOT, "src/modules");
const FIXTURES_DIR = path.join(ROOT, "tests/static/fixtures");

export const ACTION_FACTORIES = new Set(["defineAction", "definePublicAction"]);

export interface Violation {
  file: string;
  name: string;
  reason: string;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function isDefaultExport(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
  );
}

/** `defineAction(...)`, `definePublicAction<...>(...)` — the callee must be a bare identifier. */
function isActionFactoryCall(init: ts.Expression | undefined): boolean {
  if (init === undefined) return false;
  let expr: ts.Expression = init;
  // `satisfies` / `as` wrappers around the call are fine
  while (
    ts.isSatisfiesExpression(expr) ||
    ts.isAsExpression(expr) ||
    ts.isParenthesizedExpression(expr)
  ) {
    expr = expr.expression;
  }
  return (
    ts.isCallExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    ACTION_FACTORIES.has(expr.expression.text)
  );
}

function checkDeclarator(
  decl: ts.VariableDeclaration,
  file: string,
  out: Violation[],
  exportedAs?: string,
): void {
  const name = exportedAs ?? decl.name.getText();
  if (!ts.isIdentifier(decl.name)) {
    out.push({ file, name, reason: "destructured export; actions must be named consts" });
    return;
  }
  if (!isActionFactoryCall(decl.initializer)) {
    out.push({
      file,
      name,
      reason: "exported value is not a defineAction(...) / definePublicAction(...) call",
    });
  }
}

/** Violations in one `actions.ts` source text. */
export function scanActionsSource(file: string, source: string): Violation[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: Violation[] = [];
  const locals = new Map<
    string,
    ts.FunctionDeclaration | ts.VariableDeclaration | ts.ClassDeclaration
  >();

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) locals.set(stmt.name.text, stmt);
    if (ts.isClassDeclaration(stmt) && stmt.name) locals.set(stmt.name.text, stmt);
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) locals.set(d.name.text, d);
      }
    }
  }

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && hasExportModifier(stmt)) {
      out.push({
        file,
        name: stmt.name?.text ?? "default",
        reason: "exported function declaration (not wrapped in defineAction)",
      });
    } else if (ts.isClassDeclaration(stmt) && hasExportModifier(stmt)) {
      out.push({ file, name: stmt.name?.text ?? "default", reason: "exported class" });
    } else if (ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
      if (isDefaultExport(stmt)) out.push({ file, name: "default", reason: "default export" });
      for (const d of stmt.declarationList.declarations) checkDeclarator(d, file, out);
    } else if (ts.isExportAssignment(stmt)) {
      out.push({ file, name: "default", reason: "default export" });
    } else if (ts.isExportDeclaration(stmt)) {
      if (stmt.isTypeOnly) continue;
      if (stmt.moduleSpecifier !== undefined) {
        out.push({
          file,
          name:
            stmt.exportClause && ts.isNamedExports(stmt.exportClause)
              ? stmt.exportClause.elements.map((e) => e.name.text).join(", ")
              : "*",
          reason: "re-export from another module cannot be verified; define the action here",
        });
        continue;
      }
      if (stmt.exportClause === undefined || !ts.isNamedExports(stmt.exportClause)) continue;
      for (const el of stmt.exportClause.elements) {
        if (el.isTypeOnly) continue;
        const localName = (el.propertyName ?? el.name).text;
        const local = locals.get(localName);
        if (local === undefined) {
          out.push({ file, name: el.name.text, reason: "exported name has no local declaration" });
        } else if (ts.isFunctionDeclaration(local)) {
          out.push({
            file,
            name: el.name.text,
            reason: "exported function declaration (not wrapped in defineAction)",
          });
        } else if (ts.isClassDeclaration(local)) {
          out.push({ file, name: el.name.text, reason: "exported class" });
        } else {
          checkDeclarator(local, file, out, el.name.text);
        }
      }
    }
  }
  return out;
}

export function scanActionsFile(file: string): Violation[] {
  return scanActionsSource(path.relative(ROOT, file), fs.readFileSync(file, "utf8"));
}

function moduleActionFiles(): string[] {
  return fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => path.join(MODULES_DIR, d.name, "actions.ts"))
    .filter((f) => fs.existsSync(f))
    .sort();
}

describe("SA-07: src/modules/*/actions.ts only export defineAction / definePublicAction results", () => {
  it("every module has an actions.ts to scan", () => {
    const modules = fs
      .readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name);
    const withActions = moduleActionFiles().map((f) => path.basename(path.dirname(f)));
    expect(withActions).toEqual(modules.sort());
  });

  it("no exported action bypasses the envelope", () => {
    const violations = moduleActionFiles().flatMap(scanActionsFile);
    expect(violations).toEqual([]);
  });

  it("accepts the positive fixture (wrapped actions, type exports, empty export)", () => {
    expect(scanActionsFile(path.join(FIXTURES_DIR, "actions-wrapped.ts"))).toEqual([]);
    expect(scanActionsSource("empty.ts", "export {};\n")).toEqual([]);
    expect(scanActionsSource("empty2.ts", "")).toEqual([]);
  });

  it("rejects the negative fixture (raw functions, arrows, re-exports, default export)", () => {
    const violations = scanActionsFile(path.join(FIXTURES_DIR, "actions-not-wrapped.ts"));
    const names = violations.map((v) => v.name).sort();
    expect(names).toEqual(
      [
        "rawAction",
        "arrowAction",
        "objectOfHandlers",
        "wrongFactory",
        "renamedRaw",
        "default",
        "reExported",
      ].sort(),
    );
    expect(violations.every((v) => v.file.endsWith("actions-not-wrapped.ts"))).toBe(true);
  });
});
