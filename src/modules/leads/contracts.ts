/**
 * Leads service contract — docs/06 §2.8 API-LEAD-01..07, §3.3 `admin.overdue_digest`, D-703..D-706,
 * R-701. Leads are a 7-year record class (BR-18). Implementation in P6.
 */
import type { Context, RequestContext } from "@/lib/authz/context";
import type { TxCtx } from "@/lib/db";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type {
  AddLeadNoteInput,
  AssignLeadInput,
  ClaimLeadInput,
  CreateLeadFromChatbotInput,
  CreateLeadInput,
  CreateLeadManualInput,
  GetLeadInput,
  LeadActivityRow,
  LeadCreateResult,
  LeadDetail,
  LeadRow,
  ListLeadsInput,
  OverdueDigestDetail,
  OverdueDigestForAdmin,
  SetFollowUpInput,
  UpdateLeadStatusInput,
} from "./types";
import type { ListResult } from "@/modules/_shared/zod";

export interface LeadsService {
  /**
   * API-LEAD-01 `createLead` — public; verifies Turnstile (`CAPTCHA_FAILED`), rate class
   * `public_form`. Writes `leads(status='new', turnstile_verified=true, user_id when signed in)`
   * + `lead_activities(note, 'created from …')`; `N: lead.new` to all admins; `A: inquiry_submitted`.
   */
  createLead(ctx: Context, input: CreateLeadInput): Promise<LeadCreateResult>;

  /** API-LEAD-02 `createLeadManual` — `leads.write`. */
  createLeadManual(ctx: RequestContext, input: CreateLeadManualInput): Promise<LeadCreateResult>;

  /** API-CHAT-15 back-end: `leads(source='chatbot')` inside the chat module's transaction; `N: lead.new`. */
  createFromChatbot(input: CreateLeadFromChatbotInput, tx: TxCtx): Promise<LeadCreateResult>;

  /** API-LEAD-03 `listLeads` — `leads.read` / `leads.read_all`. */
  listLeads(ctx: RequestContext, input: ListLeadsInput): Promise<ListResult<LeadRow>>;

  /** API-LEAD-03 `getLead`. */
  getLead(ctx: RequestContext, input: GetLeadInput): Promise<LeadDetail>;

  /** API-LEAD-04 `assignLead` — `leads.assign`; `lead_activities(assignment)`; `N: lead.assigned`. */
  assignLead(ctx: RequestContext, input: AssignLeadInput): Promise<LeadRow>;

  /** API-LEAD-04 `claimLead` — `CONFLICT` when assigned to someone else. */
  claimLead(ctx: RequestContext, input: ClaimLeadInput): Promise<LeadRow>;

  /** API-LEAD-05 `updateLeadStatus` — `lead_activities(status_change)`. */
  updateLeadStatus(ctx: RequestContext, input: UpdateLeadStatusInput): Promise<LeadRow>;

  /** API-LEAD-06 `addLeadNote` / `logLeadActivity`. */
  addLeadNote(ctx: RequestContext, input: AddLeadNoteInput): Promise<LeadActivityRow>;

  /** API-LEAD-07 `setFollowUp` — `lead_activities(follow_up_set)`. */
  setFollowUp(ctx: RequestContext, input: SetFollowUpInput): Promise<LeadRow>;

  /** Pure read used by the digest job and the `overdue_follow_ups` widget. */
  collectOverdueDigest(now: Date): Promise<OverdueDigestForAdmin[]>;

  /**
   * Cron `daily/admin.overdue_digest` (docs/06 §3.3): one `E: overdue-follow-ups` (template
   * `admin-overdue-digest`) + `N: lead.overdue_digest` per admin with overdue leads or open
   * `revoke_external` tasks (R-701, D-706, D-607).
   */
  runOverdueDigestJob(job: JobContext): Promise<JobOutcome<OverdueDigestDetail>>;
}
