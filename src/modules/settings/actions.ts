"use server";

/**
 * Settings Server Actions (API-ADM-10, API-AUTH-10, PHASE-03 P3.3).
 * Uses defineAction / definePublicAction (SA-07).
 */
import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { setVisitorPreferencesSchema, updateSettingsSchema } from "./contracts";
import { settingsService } from "./service";

export const updateSettingsAction = defineAction({
  name: "API-ADM-10 settings.update",
  input: updateSettingsSchema,
  permission: "settings.write",
  handler: (input, ctx) => settingsService.updateSettings(ctx, input),
});

export const setVisitorPreferencesAction = definePublicAction({
  name: "API-AUTH-10 visitor.preferences",
  input: setVisitorPreferencesSchema,
  handler: (input, ctx) => settingsService.setVisitorPreferences(ctx, input),
});
