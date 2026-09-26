/**
 * Static test: no payment provider keys outside `src/modules/payments` (docs/06 §4.1, MASTER_SPEC §4.4).
 * Greps `orders`, `finance`, `invoices`, `entitlements` for provider keys: `manual_upi`, `manual_bank`, `razorpay`, `stripe`, `paypal`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FORBIDDEN_DIRS = [
  path.join(ROOT, "src/modules/orders"),
  path.join(ROOT, "src/modules/finance"),
  path.join(ROOT, "src/modules/invoices"),
  path.join(ROOT, "src/modules/entitlements"),
];

const FORBIDDEN_PATTERNS = [
  /\bmanual_upi\b/,
  /\bmanual_bank\b/,
  /\brazorpay\b/,
  /\bstripe\b/,
  /\bpaypal\b/,
];

function getSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("No provider keys outside payments module", () => {
  it("ensures orders, finance, invoices, entitlements contain no payment provider key references", () => {
    const violations: { file: string; line: number; text: string }[] = [];

    for (const dir of FORBIDDEN_DIRS) {
      const files = getSourceFiles(dir);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          // ignore comments or docs if needed, but per spec no code should reference them
          if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
          for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(line)) {
              violations.push({
                file: path.relative(ROOT, file),
                line: idx + 1,
                text: line.trim(),
              });
            }
          }
        });
      }
    }

    expect(
      violations,
      `Found provider key references in forbidden modules:\n${violations
        .map((v) => `${v.file}:${v.line} -> ${v.text}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
