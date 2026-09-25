/**
 * `settings` Server Actions — API-ADM-10 `updateSettings` (`settings.write`; `T: settings, content`)
 * and API-AUTH-10 `setVisitorPreferences` (visitor; cookies only).
 */
import { revalidateTag } from "next/cache";
import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { SETTINGS_CACHE_TAGS, setVisitorPreferencesSchema, updateSettingsSchema } from "./contracts";
import { applyPreferenceCookies } from "./cookies";
import { settingsService } from "./service";

export const updateSettings = defineAction({
  name: "API-ADM-10 settings.update",
  permission: "settings.write",
  input: updateSettingsSchema,
  handler: async (input, ctx) => {
    const result = await settingsService.updateSettings(ctx, input);
    for (const tag of SETTINGS_CACHE_TAGS.updateSettings) revalidateTag(tag);
    return result;
  },
});

export const setVisitorPreferences = definePublicAction({
  name: "API-AUTH-10 visitor.preferences",
  input: setVisitorPreferencesSchema,
  handler: async (input, ctx) => {
    const result = await settingsService.setVisitorPreferences(ctx, input);
    await applyPreferenceCookies(result.cookies);
    return { ok: true as const };
  },
});
