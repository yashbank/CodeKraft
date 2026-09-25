/**
 * DB-backed feature-flag loader for `src/lib/feature-flags.setFlagLoader` (docs/13 §6 precedence
 * env > `site_settings.feature_flags` > default). Installed once by `src/lib/bootstrap.ts`.
 */
import { type FlagLoader, setFlagLoader } from "@/lib/feature-flags";
import type { SettingsService } from "./contracts";

export function flagLoaderFor(service: Pick<SettingsService, "loadFlag">): FlagLoader {
  return (key) => service.loadFlag(key);
}

export function installFlagLoader(service: Pick<SettingsService, "loadFlag">): void {
  setFlagLoader(flagLoaderFor(service));
}
