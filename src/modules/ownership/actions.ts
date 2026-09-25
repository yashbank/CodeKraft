/**
 * Ownership Server Actions (docs/06 API-CAT-16, SA-07, PHASE-03 P3.8).
 * Every action is wrapped with defineAction.
 */
import { defineAction } from "@/lib/actions";
import { proposeOwnershipSchema } from "./contracts";
import { ownershipService } from "./service";

export const proposeOwnershipAction = defineAction({
  name: "API-CAT-16 proposeOwnership",
  input: proposeOwnershipSchema,
  handler: (input, ctx) => ownershipService.proposeOwnership(ctx, input),
});
