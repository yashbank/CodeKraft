/**
 * shadcn post-install codemod (PHASE-01 P1.3 risk mitigation, docs/08 §4.3, §4.5).
 *
 * Run after `pnpm dlx shadcn@latest add …`:  `pnpm tsx scripts/shadcn-postfix.ts [files…]`
 * (default: every `src/components/ui/*.tsx`).
 *
 * What it does, in order:
 *  1. Re-points imports the generator hardcodes (`cn`, `@/lib/utils`, `@/hooks/use-mobile`)
 *     to the P1.3-owned modules under `src/components/ui/` (src/lib and src/hooks are not ours).
 *  2. Strips every `dark:` variant class. Themes are `[data-theme]` attributes; the `dark`
 *     variant is neutralised in tokens.css, so these classes are dead weight.
 *  3. Replaces the few hardcoded Tailwind palette classes shadcn ships (`bg-black/50`,
 *     `text-white`) with semantic token classes, and fails loudly on any colour literal left
 *     over (hex, rgb(), hsl(), oklch(), palette utilities) so the eslint rule
 *     `codekraft/no-hardcoded-colors` never has to catch it downstream.
 *  4. Runs prettier on the touched files.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const UI_DIR = path.resolve(process.cwd(), "src/components/ui");

const IMPORT_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/from\s+["']cn["']/g, 'from "@/components/ui/_utils"'],
  [/from\s+["']@\/lib\/utils["']/g, 'from "@/components/ui/_utils"'],
  [/from\s+["']@\/hooks\/use-mobile["']/g, 'from "@/components/ui/_use-mobile"'],
];

/** Hardcoded palette classes → semantic tokens (docs/08 §4.3 "Never bg-[#…]"). */
const CLASS_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  // shadcn's `accent` means the *soft* hover fill; in our bridge `bg-accent` is the solid brand
  // accent (docs/08 §4.3), so the hover/selection classes are re-pointed at the soft pair.
  [/\bbg-accent(?:\/\d+)?(?![-\w])/g, "bg-accent-soft"],
  [/\btext-accent-foreground\b/g, "text-accent-text"],
  [/\bbg-black\/\d+\b/g, "bg-overlay"],
  [/\bbg-white\b/g, "bg-surface"],
  [/\btext-white\b/g, "text-destructive-foreground"],
  [/\btext-black\b/g, "text-fg"],
];

const DARK_VARIANT = /(^|\s)dark:\S+/g;
const PALETTE_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|shadow|accent|caret|decoration|divide|placeholder)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d+)?\b/;
const COLOR_LITERAL = /(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\()/;

function stripDarkVariants(source: string): string {
  // Only touch string/template literal contents: JSX className strings and cva() tables.
  return source.replace(
    /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g,
    (whole, quote: string, body: string) => {
      if (!body.includes("dark:")) return whole;
      const cleaned = body
        .replace(DARK_VARIANT, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return `${quote}${cleaned}${quote}`;
    },
  );
}

function postfix(file: string): { changed: boolean; leftovers: string[] } {
  const original = readFileSync(file, "utf8");
  let next = original;
  for (const [re, to] of IMPORT_REWRITES) next = next.replace(re, to);
  next = stripDarkVariants(next);
  for (const [re, to] of CLASS_REWRITES) next = next.replace(re, to);

  const leftovers: string[] = [];
  next.split("\n").forEach((line, i) => {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
    if (PALETTE_CLASS.test(line) || COLOR_LITERAL.test(line)) {
      leftovers.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
    }
  });

  if (next !== original) writeFileSync(file, next);
  return { changed: next !== original, leftovers };
}

function main(argv: string[]): number {
  const files =
    argv.length > 0
      ? argv.map((f) => path.resolve(process.cwd(), f))
      : readdirSync(UI_DIR)
          .filter((f) => f.endsWith(".tsx"))
          .map((f) => path.join(UI_DIR, f));

  const changed: string[] = [];
  const leftovers: string[] = [];
  for (const file of files) {
    const result = postfix(file);
    if (result.changed) changed.push(file);
    leftovers.push(...result.leftovers);
  }

  if (changed.length > 0) {
    execFileSync("pnpm", ["exec", "prettier", "--write", ...changed], { stdio: "inherit" });
  }
  console.log(`shadcn-postfix: ${files.length} file(s) scanned, ${changed.length} rewritten.`);

  if (leftovers.length > 0) {
    console.error(
      "shadcn-postfix: hardcoded colours remain — fix by hand:\n" + leftovers.join("\n"),
    );
    return 1;
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
