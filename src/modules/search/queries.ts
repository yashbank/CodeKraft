"use server";

/**
 * Search read-only queries (API-CAT-30, API-CAT-32, PHASE-03 P3.6).
 * Public queries use definePublicAction (SA-07).
 */
import { z } from "zod";
import { definePublicAction } from "@/lib/actions/envelope";
import { listFilterFacetsSchema, listProductsSchema } from "./contracts";
import { searchService } from "./service";

export const listProductsQuery = definePublicAction({
  name: "API-CAT-30 listProducts",
  input: listProductsSchema,
  handler: (input, ctx) => searchService.listProducts(ctx, input),
});

export const listFilterFacetsQuery = definePublicAction({
  name: "API-CAT-32 listFilterFacets",
  input: listFilterFacetsSchema,
  handler: (input, ctx) => searchService.listFilterFacets(ctx, input),
});

export const listPublishedSlugsQuery = definePublicAction({
  name: "API-CAT-30 listPublishedSlugs",
  input: z.object({}),
  handler: (_input, _ctx) => searchService.listPublishedSlugs(),
});
