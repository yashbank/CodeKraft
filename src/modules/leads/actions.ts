"use server";

/**
 * `leads` Server Actions — owned by P6 (master plan §3 ownership map). `leadsService` is fully
 * implemented (see `service.ts`); this file adds the `defineAction` wrappers P2.8 left empty
 * (SA-07: every export here must be created with `defineAction` / `definePublicAction`).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  addLeadNoteSchema,
  assignLeadSchema,
  claimLeadSchema,
  createLeadManualSchema,
  setFollowUpSchema,
  updateLeadStatusSchema,
} from "./types";
import { leadsService } from "./service";

export const createLeadManualAction = defineAction({
  name: "API-LEAD-02 createLeadManual",
  input: createLeadManualSchema,
  permission: "leads.write",
  handler: (input, ctx) => leadsService.createLeadManual(ctx, input),
});

export const assignLeadAction = defineAction({
  name: "API-LEAD-04 assignLead",
  input: assignLeadSchema,
  permission: "leads.assign",
  handler: (input, ctx) => leadsService.assignLead(ctx, input),
});

export const claimLeadAction = defineAction({
  name: "API-LEAD-04 claimLead",
  input: claimLeadSchema,
  permission: "leads.assign",
  handler: (input, ctx) => leadsService.claimLead(ctx, input),
});

export const updateLeadStatusAction = defineAction({
  name: "API-LEAD-05 updateLeadStatus",
  input: updateLeadStatusSchema,
  permission: "leads.write",
  handler: (input, ctx) => leadsService.updateLeadStatus(ctx, input),
});

export const addLeadNoteAction = defineAction({
  name: "API-LEAD-06 addLeadNote",
  input: addLeadNoteSchema,
  permission: "leads.write",
  handler: (input, ctx) => leadsService.addLeadNote(ctx, input),
});

export const setFollowUpAction = defineAction({
  name: "API-LEAD-07 setFollowUp",
  input: setFollowUpSchema,
  permission: "leads.write",
  handler: (input, ctx) => leadsService.setFollowUp(ctx, input),
});
