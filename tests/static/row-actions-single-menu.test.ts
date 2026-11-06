/**
 * G18-3a guard: an admin list row carries ONE per-row control at most, and when a row has the
 * kebab menu (RowActions) it carries nothing else button-like beside it. This stops inline
 * Edit / Delete / Move / Copy buttons creeping back next to the 3-dot menu.
 *
 * Raw <button> elements are ignored on purpose: they are the row's name or disclosure target
 * (open the detail drawer), not an action. Rows that hold a single design-system <Button>
 * (a lone expand chevron, a form-line remove) are allowed; two or more are not.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../src/components/admin");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

/** Return the source text of every <Tag ...>...</Tag> block, honouring nesting of the same tag. */
function blocks(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])`, "g");
  const stack: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1] === "/") {
      const start = stack.pop();
      if (start !== undefined) out.push(src.slice(start, src.indexOf(">", m.index) + 1));
    } else {
      // Self-closing tags never open a block.
      const end = src.indexOf(">", m.index);
      if (src[end - 1] !== "/") stack.push(m.index);
    }
  }
  return out;
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("admin list rows: one 3-dot menu, no inline button clusters", () => {
  const offenders: string[] = [];
  for (const file of walk(ROOT)) {
    // The primitive itself and the theme studio (a design picker, not a list) are exempt.
    if (file.endsWith("RowActions.tsx") || file.includes("theme-studio")) continue;
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const tag of ["TableRow", "li", "SortableRow"]) {
      for (const b of blocks(src, tag)) {
        if (tag === "TableRow" && /<TableHead[\s>]/.test(b)) continue; // header row
        // Only judge the innermost rows: skip a block that wraps another row of the same kind.
        if (tag !== "SortableRow" && count(b, new RegExp(`<${tag}[\\s>]`, "g")) > 1) continue;
        const menus = count(b, /<RowActions[\s>]/g);
        const buttons = count(b, /<Button[\s>]/g);
        if (menus > 1 || buttons > 1 || (menus === 1 && buttons >= 1)) {
          const line = src.slice(0, src.indexOf(b)).split("\n").length;
          offenders.push(`${rel}:${line} <${tag}> has ${menus} menu + ${buttons} buttons`);
        }
      }
    }
  }

  it("has no row with more than the single menu trigger", () => {
    expect(offenders).toEqual([]);
  });

  it("RowActions keeps a 44px trigger and puts destructive items last", () => {
    const src = fs.readFileSync(path.join(ROOT, "RowActions.tsx"), "utf8");
    expect(src).toMatch(/size-11/);
    expect(src).toMatch(/filter\(\(a\) => a\.destructive\)/);
    expect(src).toMatch(/aria-label=\{label\}/);
  });
});
