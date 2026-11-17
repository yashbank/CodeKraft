import { readFile } from "node:fs/promises";
import path from "node:path";

import { getHelpConfig } from "@/modules/help/config";
import { helpAllowed } from "@/modules/help/role";
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

/**
 * Server wrapper for layouts: reads getHelpConfig() + suggestions and mounts the launcher once.
 * P22-1: staff, partners and admins only (admin layout). Customers get nothing, whatever the caller
 * passes. The public site and account layouts do not mount it: admin-class users live on the admin
 * host with a separate session cookie, so they are never signed in on the public site.
 */
export async function HelpMount({
  audience,
  area,
  inline = false,
}: Readonly<{ audience: HelpRole; area: "site" | "account" | "admin"; inline?: boolean }>) {
  if (!helpAllowed(audience)) return null;
  const cfg = await getHelpConfig().catch(() => null);
  if (!cfg?.enabled) return null;
  return (
    <HelpLauncher
      helpEnabled
      hindiEnabled={cfg.hindi}
      role={audience}
      area={area}
      variant={inline ? "inline" : "floating"}
      suggestions={await loadSuggestions(audience)}
    />
  );
}
