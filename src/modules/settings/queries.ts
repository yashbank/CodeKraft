/**
 * `settings` read models — API-ADM-10 `getSettings` (`settings.read`) and API-AUTH-09
 * `getPublicSettings` (visitor; cached under `T: settings` by the page layer).
 */
import { z } from "zod";
import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { settingsService } from "./service";

const noInput = z.strictObject({}).optional();

export const getSettings = defineAction({
  name: "API-ADM-10 settings.get",
  permission: "settings.read",
  input: noInput,
  handler: (_input, ctx) => settingsService.getSettings(ctx),
});

export const getPublicSettings = definePublicAction({
  name: "API-AUTH-09 settings.public",
  input: noInput,
  handler: (_input, ctx) => settingsService.getPublicSettings(ctx),
});
