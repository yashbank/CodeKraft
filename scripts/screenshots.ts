/**
 * Captures every registered preview screen (src/app/dev/screens/registry.ts) in both themes as PNG
 * into ui/screenshots/<group>/<SCR-ID>--<theme>.png. Usage: pnpm dev (running) then `pnpm tsx scripts/screenshots.ts`.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const THEMES = ["dark-cinematic", "light-editorial"] as const;
const registry = readFileSync("src/app/dev/screens/registry.ts", "utf8");
const entries = [
  ...registry.matchAll(/id:\s*"([^"]+)"[\s\S]*?href:\s*"([^"]+)"[\s\S]*?group:\s*"([^"]+)"/g),
].map((m) => ({ id: m[1]!, href: m[2]!, group: m[3]! }));

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  let n = 0;
  const failures: string[] = [];
  for (const e of entries) {
    for (const theme of THEMES) {
      await page.context().addCookies([{ name: "ck_theme", value: theme, url: BASE }]);
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          await page.goto(`${BASE}${e.href}`, { waitUntil: "load", timeout: 30_000 });
          ok = true;
        } catch (err) {
          if (attempt === 1) {
            failures.push(`${e.id} ${theme}: ${(err as Error).message.split("\n")[0]}`);
          }
        }
      }
      if (!ok) continue;
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.waitForTimeout(600);
      const dir = path.join("ui/screenshots", e.group);
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${e.id.replace(/[^A-Za-z0-9-]+/g, "_")}--${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      n++;
    }
  }
  await browser.close();
  console.log(`captured ${n} screenshots for ${entries.length} screens`);
  if (failures.length) {
    console.log("failed:");
    for (const f of failures) console.log("  " + f);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
