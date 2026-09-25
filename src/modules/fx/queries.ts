"use server";

/**
 * FX read-only queries — docs/06 API-FIN-12, PHASE-03 P3.12.
 * Wrapped in defineAction / definePublicAction (SA-07).
 */
import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import { z } from "zod";
import { getFxRateSchema } from "./contracts";
import { fxService } from "./service";

export const listRatesQuery = defineAction({
  name: "API-FIN-12 listRates",
  input: z.object({}),
  permission: "settings.read",
  handler: (_input, ctx) => fxService.listRates(ctx),
});

export const getFxRateQuery = definePublicAction({
  name: "API-FIN-12 getFxRate",
  input: getFxRateSchema,
  handler: (input) => fxService.getRate(input),
});
