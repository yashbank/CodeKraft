/**
 * Turns Playwright JSON results (test-results/r9.json) into BUGS-R9.md, ranked by severity.
 * S1 crash/5xx/blocked flow, S2 wrong data/broken control/console error, S3 cosmetic (overflow).
 * Test titles are `[role] route - what`; width comes from the project (desktop 1280, mobile 412).
 * Usage: tsx scripts/e2e/bugs-r9.ts [in.json] [out.md]
 */
import fs from "node:fs";

interface Spec {
  title: string;
  file: string;
  tests: {
    projectName: string;
    status: string;
    results: { status: string; error?: { message?: string } }[];
  }[];
}
interface Suite {
  specs?: Spec[];
  suites?: Suite[];
}

const inFile = process.argv[2] ?? "test-results/r9.json";
const outFile = process.argv[3] ?? "BUGS-R9.md";
const WIDTH: Record<string, number> = { "r9-desktop": 1280, "r9-mobile": 412 };

// shortcut: severity is guessed from the error text; refine by hand in BUGS-R9.md if wrong.
function severity(msg: string): "S1" | "S2" | "S3" {
  if (/horizontal overflow/.test(msg)) return "S3";
  if (
    /\b5\d\d\b|HTTP status|pageerror|Timeout|page load hung|toHaveURL|redirected away|no checkout link|staff sees/.test(
      msg,
    )
  )
    return "S1";
  return "S2";
}
// eslint-disable-next-line no-control-regex
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
function collect(s: Suite, out: Spec[]) {
  out.push(...(s.specs ?? []));
  for (const c of s.suites ?? []) collect(c, out);
}

const json = JSON.parse(fs.readFileSync(inFile, "utf8")) as Suite;
const specs: Spec[] = [];
collect(json, specs);
const rows: { sev: string; line: string }[] = [];
let pass = 0;
for (const sp of specs)
  for (const t of sp.tests) {
    if (t.status === "expected" || t.status === "skipped") {
      pass++;
      continue;
    }
    const m = /^\[([\w-]+)\]\s+(\S+)\s+-\s+(.*)$/.exec(sp.title);
    const [role, route, what] = m ? [m[1], m[2], m[3]] : ["?", sp.title, ""];
    const raw = strip(t.results.at(-1)?.error?.message ?? "failed");
    const first =
      raw
        .split("\n")
        .filter((l) => /Error:|expect|Expected|Received|^\d{3} |console:|pageerror/.test(l))
        .slice(0, 2)
        .join(" | ") || raw.split("\n")[0];
    rows.push({
      sev: severity(raw),
      line: `- [${t.projectName}] route \`${route}\` role \`${role}\` width ${WIDTH[t.projectName] ?? "?"}: ${what} - ${first!.slice(0, 220).replace(/\s+/g, " ")}`,
    });
  }
rows.sort((a, b) => a.sev.localeCompare(b.sev));
const md = [
  "# BUGS-R9",
  "",
  `Generated from ${inFile}: ${rows.length} failing, ${pass} passing.`,
  "",
];
for (const s of ["S1", "S2", "S3"]) {
  md.push(
    `## ${s}`,
    "",
    ...(rows
      .filter((r) => r.sev === s)
      .map((r) => r.line)
      .concat() || []),
    "",
  );
}
fs.writeFileSync(outFile, md.join("\n"));
console.log(
  `BUGS-R9.md: ${rows.length} failing (${["S1", "S2", "S3"].map((s) => `${s}=${rows.filter((r) => r.sev === s).length}`).join(" ")}), ${pass} passing`,
);
