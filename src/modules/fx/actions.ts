"use server";

/**
 * FX Server Actions — docs/06 API-FIN-12, PHASE-03 P3.12.
 * Wrapped in defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { refreshFxRatesSchema, setFxOverrideSchema } from "./contracts";
import { fxService } from "./service";

export const refreshFxRatesAction = defineAction({
  name: "API-FIN-12 fx.refresh",
  input: refreshFxRatesSchema,
  permission: "settings.write",
  handler: (input, ctx) => fxService.refreshFxRates(ctx, input),
});

export const setFxOverrideAction = defineAction({
  name: "API-FIN-12 fx.override",
  input: setFxOverrideSchema,
  permission: "settings.write",
  handler: (input, ctx) => fxService.setFxOverride(ctx, input),
});
