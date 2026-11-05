// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

// next build cannot compile client-only React APIs in the server bundle; vitest does not catch it.
const ROOT = path.resolve(import.meta.dirname, "../../src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = path.join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
const CLIENT_ONLY = /\b(createContext|useContext|useState|useEffect|useReducer|useLayoutEffect)\b/;

it("email code imports no client-only React API", () => {
  const files = [...walk(path.join(ROOT, "lib/email")), ...walk(path.join(ROOT, "emails"))];
  expect(files.length).toBeGreaterThan(3);
  const bad = files.filter((f) =>
    [
      ...readFileSync(f, "utf8").matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"react"/g),
    ].some((m) => CLIENT_ONLY.test(m[1]!)),
  );
  expect(bad).toEqual([]);
});
