/**
 * Chat-relevant `site_settings` (docs/04 §9 controls, D-708, D-1503): `ai_model`, the daily caps,
 * `chat_timeout_ms` and the transcript retention horizon. Read straight from the key/value table
 * with the release-1 defaults as fallback so the chat module never depends on the settings
 * service's runtime wiring (another agent's module); `SITE_SETTINGS_DEFAULTS` / `SITE_SETTING_KEYS`
 * are frozen P2 contract values.
 */
import { inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { SITE_SETTINGS_DEFAULTS } from "@/modules/settings/contracts";
import { SITE_SETTING_KEYS } from "@/modules/settings/types";
import { siteSettings } from "../../../drizzle/schema/settings";

export interface ChatSettings {
  aiModel: string;
  aiDailyPlatformCap: number;
  aiDailyUserCap: number;
  chatTimeoutMs: number;
  /** Months before a transcript's `purge_after` (D-1503). */
  retentionChatMonths: number;
}

export type ChatSettingsReader = (db: DbOrTx) => Promise<ChatSettings>;

/** docs/04 §9 fixes the chat timeout at 20 s; the settings default is the generic 30 s. */
export const CHAT_TIMEOUT_DEFAULT_MS = 20_000;
export const CHAT_MAX_OUTPUT_TOKENS = 600;

export const CHAT_SETTINGS_DEFAULTS: ChatSettings = Object.freeze({
  aiModel: SITE_SETTINGS_DEFAULTS.aiModel,
  aiDailyPlatformCap: SITE_SETTINGS_DEFAULTS.aiDailyPlatformCap,
  aiDailyUserCap: SITE_SETTINGS_DEFAULTS.aiDailyUserCap,
  chatTimeoutMs: CHAT_TIMEOUT_DEFAULT_MS,
  retentionChatMonths: SITE_SETTINGS_DEFAULTS.retention.chatMonths,
});

function int(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** Load the chat settings from `site_settings`, defaulting every missing or malformed key. */
export const loadChatSettings: ChatSettingsReader = async (db) => {
  const keys = [
    SITE_SETTING_KEYS.aiModel,
    SITE_SETTING_KEYS.aiDailyPlatformCap,
    SITE_SETTING_KEYS.aiDailyUserCap,
    SITE_SETTING_KEYS.chatTimeoutMs,
    SITE_SETTING_KEYS.retention,
  ];
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(inArray(siteSettings.key, keys));
  const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
  const model = map.get(SITE_SETTING_KEYS.aiModel);
  const retention = map.get(SITE_SETTING_KEYS.retention);
  const retentionMonths =
    typeof retention === "object" && retention !== null
      ? (retention as { chatMonths?: unknown }).chatMonths
      : undefined;
  return {
    aiModel:
      typeof model === "string" && model.trim() !== "" ? model.trim() : CHAT_SETTINGS_DEFAULTS.aiModel,
    aiDailyPlatformCap: int(
      map.get(SITE_SETTING_KEYS.aiDailyPlatformCap),
      CHAT_SETTINGS_DEFAULTS.aiDailyPlatformCap,
      0,
      1_000_000,
    ),
    aiDailyUserCap: int(
      map.get(SITE_SETTING_KEYS.aiDailyUserCap),
      CHAT_SETTINGS_DEFAULTS.aiDailyUserCap,
      0,
      10_000,
    ),
    chatTimeoutMs: int(
      map.get(SITE_SETTING_KEYS.chatTimeoutMs),
      CHAT_SETTINGS_DEFAULTS.chatTimeoutMs,
      1_000,
      120_000,
    ),
    retentionChatMonths: int(retentionMonths, CHAT_SETTINGS_DEFAULTS.retentionChatMonths, 1, 120),
  };
};
