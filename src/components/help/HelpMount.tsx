import { readFile } from "node:fs/promises";
import path from "node:path";

import { getHelpConfig } from "@/modules/help/config";
import { HelpLauncher } from "./HelpLauncher";
import { normalizeSuggestions } from "./suggestions";
import type { HelpRole } from "./types";

async function loadSuggestions(role: HelpRole) {
  let raw: unknown = null;
  try {
    const file = path.join(process.cwd(), "src/modules/help/knowledge/suggestions.json");
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* file missing or invalid: built-in defaults */
  }
  return normalizeSuggestions(raw, role);
}

/** Server wrapper for layouts: reads getHelpConfig() + suggestions and mounts the launcher once. */
export async function HelpMount({
  audience,
  area,
}: Readonly<{ audience: HelpRole; area: "site" | "account" | "admin" }>) {
  const cfg = await getHelpConfig().catch(() => null);
  if (!cfg?.enabled) return null;
  return (
    <HelpLauncher
      helpEnabled
      hindiEnabled={cfg.hindi}
      role={audience}
      area={area}
      suggestions={await loadSuggestions(audience)}
    />
  );
}
