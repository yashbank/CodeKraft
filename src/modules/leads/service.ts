/**
 * `leads` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P6; the signatures are
 * the frozen `LeadsService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { LeadsService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "leads.<method> not implemented (P6)")`. */
export function createNotImplementedLeadsService(): LeadsService {
  return createNotImplemented<LeadsService>("leads", "P6", {
    createLead: "async",
    createLeadManual: "async",
    createFromChatbot: "async",
    listLeads: "async",
    getLead: "async",
    assignLead: "async",
    claimLead: "async",
    updateLeadStatus: "async",
    addLeadNote: "async",
    setFollowUp: "async",
    collectOverdueDigest: "async",
    runOverdueDigestJob: "async",
  });
}
