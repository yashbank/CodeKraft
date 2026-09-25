"use server";

/**
 * Settings queries (API-ADM-10, API-AUTH-09, PHASE-03 P3.3).
 * Uses defineAction / definePublicAction (SA-07).
 */
import { z } from "zod";
import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { settingsService } from "./service";

const emptyQueryInput = z.strictObject({});

export const getSettingsQuery = defineAction({
  name: "API-ADM-10 settings.get",
  input: emptyQueryInput,
  permission: "settings.read",
  handler: (_input, ctx) => settingsService.getSettings(ctx),
});

export const getPublicSettingsQuery = definePublicAction({
  name: "API-AUTH-09 settings.public",
  input: emptyQueryInput,
  handler: (_input, ctx) => settingsService.getPublicSettings(ctx),
});
