/**
 * Settings export / import (P14-12a). Pure: the server actions in `transfer-actions.ts` add the
 * super-admin gate, audit and the write itself (through the normal `updateSettings` action).
 * The file never carries gateway/bank secrets, and an import that contains them is refused.
 */
import { updateSettingsSchema } from "./contracts";
import type { SiteSettings } from "./types";

export const SETTINGS_EXPORT_FORMAT = "codekraft.settings";
export const SETTINGS_EXPORT_VERSION = 1;
/** Secret-bearing keys: never exported, never importable. */
export const SECRET_SETTING_KEYS = ["razorpaySettings", "bankDetails"] as const;
export const MAX_IMPORT_CHARS = 600_000;

export interface SettingsExportFile {
  format: typeof SETTINGS_EXPORT_FORMAT;
  version: typeof SETTINGS_EXPORT_VERSION;
  exportedAt: string;
  settings: Record<string, unknown>;
}

export function buildSettingsExport(settings: SiteSettings, now = new Date()): SettingsExportFile {
  const copy: Record<string, unknown> = Object.fromEntries(
    Object.entries(settings).filter(
      ([k]) => !(SECRET_SETTING_KEYS as readonly string[]).includes(k),
    ),
  );
  return {
    format: SETTINGS_EXPORT_FORMAT,
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    settings: copy,
  };
}

export type ParsedImport =
  { ok: true; patch: Record<string, unknown> } | { ok: false; error: string };

export function parseSettingsImport(text: string): ParsedImport {
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: "File is too large." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  const file = raw as Partial<SettingsExportFile> | null;
  if (!file || file.format !== SETTINGS_EXPORT_FORMAT || file.version !== SETTINGS_EXPORT_VERSION) {
    return { ok: false, error: "Not a CodeKraft settings export (format/version mismatch)." };
  }
  const settings = file.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { ok: false, error: "The file has no settings object." };
  }
  const secret = SECRET_SETTING_KEYS.find((k) => k in settings);
  if (secret) return { ok: false, error: `Secrets can't be imported (${secret}).` };
  const parsed = updateSettingsSchema.safeParse({ patch: settings });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Invalid settings: ${issue?.path.join(".") || "file"} ${issue?.message ?? ""}`.trim(),
    };
  }
  return { ok: true, patch: parsed.data.patch as Record<string, unknown> };
}

export interface SettingDiff {
  key: string;
  before: unknown;
  after: unknown;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keys whose imported value differs from the current one (flags are compared per flag). */
export function diffSettings(
  current: Partial<SiteSettings>,
  patch: Record<string, unknown>,
): SettingDiff[] {
  const out: SettingDiff[] = [];
  for (const [key, after] of Object.entries(patch)) {
    if (key === "flags" && after && typeof after === "object") {
      const before = (current.flags ?? {}) as Record<string, boolean>;
      for (const [flag, v] of Object.entries(after as Record<string, boolean>)) {
        if (before[flag] !== v) out.push({ key: `flags.${flag}`, before: before[flag], after: v });
      }
    } else if (!same((current as Record<string, unknown>)[key], after)) {
      out.push({ key, before: (current as Record<string, unknown>)[key], after });
    }
  }
  return out;
}

/** The patch reduced to what actually changes, ready for `updateSettings`. */
export function patchFromDiff(patch: Record<string, unknown>, diff: SettingDiff[]) {
  const keys = new Set(diff.map((d) => d.key.split(".")[0]));
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k === undefined) continue;
    if (k === "flags") {
      const changed = diff.filter((d) => d.key.startsWith("flags."));
      out.flags = Object.fromEntries(changed.map((d) => [d.key.slice(6), d.after]));
    } else out[k] = patch[k];
  }
  return out;
}
