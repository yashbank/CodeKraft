/**
 * Ownership read-only queries (docs/06 API-CAT-19, SA-07, PHASE-03 P3.8).
 * Queries are wrapped with defineAction.
 */
import { defineAction } from "@/lib/actions";
import { listOwnershipVersionsSchema } from "./contracts";
import { ownershipService } from "./service";

export const listOwnershipVersionsQuery = defineAction({
  name: "API-CAT-19 listOwnershipVersions",
  input: listOwnershipVersionsSchema,
  handler: (input, ctx) => ownershipService.listVersions(ctx, input),
});
