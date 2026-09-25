/**
 * `fx` read models — Settings → Currencies table (`settings.read`) and the rate lookup used by
 * pricing previews (`getFxRate`, `settings.read`).
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { getFxRateSchema } from "./contracts";
import { fxService } from "./service";

export const listFxRates = defineAction({
  name: "API-FIN-12 fx.list",
  permission: "settings.read",
  input: z.strictObject({}).optional(),
  handler: (_input, ctx) => fxService.listRates(ctx),
});

export const getFxRate = defineAction({
  name: "API-FIN-12 fx.get",
  permission: "settings.read",
  input: getFxRateSchema,
  handler: (input) => fxService.getRate(input),
});
