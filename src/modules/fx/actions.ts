/**
 * `fx` Server Actions — API-FIN-12 `refreshFxRates` (admin trigger of the daily job) and
 * `setFxOverride` (`source='manual'`), both `settings.write` and audited.
 */
import { defineAction } from "@/lib/actions/envelope";
import { refreshFxRatesSchema, setFxOverrideSchema } from "./contracts";
import { fxService } from "./service";

export const refreshFxRates = defineAction({
  name: "API-FIN-12 fx.refresh",
  permission: "settings.write",
  input: refreshFxRatesSchema,
  handler: (input, ctx) => fxService.refreshFxRates(ctx, input),
});

export const setFxOverride = defineAction({
  name: "API-FIN-12 fx.override",
  permission: "settings.write",
  input: setFxOverrideSchema,
  handler: (input, ctx) => fxService.setFxOverride(ctx, input),
});
