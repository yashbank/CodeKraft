import { and, desc, eq, gt, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { type TxCtx, getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertTurnstileVerified, checkHoneypot, verifyTurnstile } from "@/lib/turnstile";
import { notificationsService } from "@/modules/notifications/service";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
import { users } from "../../../drizzle/schema/auth";
import { products } from "../../../drizzle/schema/catalog";
import { orders } from "../../../drizzle/schema/commerce";
import { deliveryTasks } from "../../../drizzle/schema/delivery";
import {
  type Lead,
  type LeadActivity,
  leadActivities,
  leads,
} from "../../../drizzle/schema/leads";
import type { LeadsService } from "./contracts";
import { assertValidLeadStatusTransition } from "./state";
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

export class DefaultLeadsService implements LeadsService {
  private _db?: any;
  constructor(db?: any) {
    this._db = db;
  }
  private get db(): any {
    return this._db ?? getDb();
  }

  async createLead(ctx: Context, input: CreateLeadInput): Promise<LeadCreateResult> {
    const turnstileRes = await verifyTurnstile(input.turnstileToken);
    assertTurnstileVerified(turnstileRes);

    checkHoneypot((input as any).website);

    const [lead] = await this.db
      .insert(leads)
      .values({
        source: input.source,
        productId: input.productId ?? null,
        userId: ctx.userId ?? null,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        company: input.company ?? null,
        message: input.message,
        serviceInterest: input.serviceInterest ?? [],
        budgetHint: input.budgetHint ?? null,
        status: "new",
        priority: "normal",
        turnstileVerified: true,
      })
      .returning();

    await this.db.insert(leadActivities).values({
      leadId: lead.id,
      actorId: ctx.userId ?? null,
      kind: "note",
      body: `Created from ${input.source}`,
    });

    await notificationsService.emit(
      "admins",
      "lead.new",
      {
        leadId: lead.id,
        leadName: lead.name,
        company: lead.company,
        message: lead.message,
      },
      undefined,
      this.db,
    );

    return { leadId: lead.id };
  }

  async createLeadManual(
    ctx: RequestContext,
    input: CreateLeadManualInput,
  ): Promise<LeadCreateResult> {
    const [lead] = await this.db
      .insert(leads)
      .values({
        source: "manual",
        productId: input.productId ?? null,
        userId: ctx.userId ?? null,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        message: input.message ?? null,
        serviceInterest: input.serviceInterest ?? [],
        budgetHint: input.budgetHint ?? null,
        status: "new",
        assignedTo: input.assignedTo ?? null,
        priority: input.priority ?? "normal",
        turnstileVerified: false,
      })
      .returning();

    await this.db.insert(leadActivities).values({
      leadId: lead.id,
      actorId: ctx.userId,
      kind: "note",
      body: "Created manually by admin",
    });

    if (input.assignedTo) {
      await notificationsService.emit(
        input.assignedTo,
        "lead.assigned",
        { leadId: lead.id, leadName: lead.name },
        undefined,
        this.db,
      );
    }

    return { leadId: lead.id };
  }

  async createFromChatbot(
    input: CreateLeadFromChatbotInput,
    tx: TxCtx,
  ): Promise<LeadCreateResult> {
    const [lead] = await tx
      .insert(leads)
      .values({
        source: "chatbot",
        userId: input.userId,
        name: input.name,
        email: input.email,
        message: input.message,
        status: "new",
        priority: "normal",
        turnstileVerified: true,
      })
      .returning();

    await tx.insert(leadActivities).values({
      leadId: lead.id,
      actorId: input.userId,
      kind: "note",
      body: "Captured from AI chatbot conversation",
      meta: { conversationId: input.conversationId },
    });

    await notificationsService.emit(
      "admins",
      "lead.new",
      {
        leadId: lead.id,
        leadName: lead.name,
        message: lead.message,
      },
      undefined,
      tx,
    );

    return { leadId: lead.id };
  }

  async listLeads(
    ctx: RequestContext,
    input: ListLeadsInput,
  ): Promise<ListResult<LeadRow>> {
    const conditions: any[] = [];

    // Role-scoping: if regular admin, only see assigned to self or unassigned
    const isAdmin = ctx.roles.includes("admin");
    const isSuperAdmin = ctx.roles.includes("super_admin");

    if (isAdmin && !isSuperAdmin) {
      conditions.push(or(eq(leads.assignedTo, ctx.userId), isNull(leads.assignedTo)));
    }

    if (input.status) {
      conditions.push(eq(leads.status, input.status));
    }

    if (input.assignedTo) {
      if (input.assignedTo === "me") {
        conditions.push(eq(leads.assignedTo, ctx.userId));
      } else if (input.assignedTo === "unassigned") {
        conditions.push(isNull(leads.assignedTo));
      } else {
        conditions.push(eq(leads.assignedTo, input.assignedTo));
      }
    }

    if (input.overdue) {
      const now = new Date();
      conditions.push(
        and(
          lt(leads.nextFollowUpAt, now),
          notInArray(leads.status, ["won", "lost"]),
        ),
      );
    }

    const rows = await this.db
      .select({
        lead: leads,
        assigneeName: users.name,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leads.createdAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const now = new Date();
    const items: LeadRow[] = selected.map((r) => {
      const isOverdue =
        !!r.lead.nextFollowUpAt &&
        r.lead.nextFollowUpAt < now &&
        !["won", "lost"].includes(r.lead.status);

      return {
        leadId: r.lead.id,
        source: r.lead.source as any,
        name: r.lead.name,
        email: r.lead.email,
        phone: r.lead.phone,
        company: r.lead.company,
        status: r.lead.status as any,
        priority: r.lead.priority as any,
        assignedTo: r.lead.assignedTo
          ? { id: r.lead.assignedTo, name: r.assigneeName ?? null }
          : null,
        productId: r.lead.productId,
        nextFollowUpAt: r.lead.nextFollowUpAt
          ? r.lead.nextFollowUpAt.toISOString()
          : null,
        overdue: isOverdue,
        createdAt: r.lead.createdAt.toISOString(),
        updatedAt: r.lead.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total: countResult[0]?.count ?? 0,
      nextCursor: hasNext ? items[items.length - 1].leadId : null,
    };
  }

  async getLead(ctx: RequestContext, input: GetLeadInput): Promise<LeadDetail> {
    const rows = await this.db
      .select({
        lead: leads,
        assigneeName: users.name,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(eq(leads.id, input.leadId))
      .limit(1);

    if (rows.length === 0) {
      throw new AppError("NOT_FOUND", "Lead not found");
    }

    const { lead, assigneeName } = rows[0];

    // Check scope
    const isSuperAdmin = ctx.roles.includes("super_admin");
    if (!isSuperAdmin && lead.assignedTo && lead.assignedTo !== ctx.userId) {
      throw new AppError("FORBIDDEN", "Access denied to this lead");
    }

    const activities = await this.db
      .select({
        activity: leadActivities,
        actorName: users.name,
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.actorId, users.id))
      .where(eq(leadActivities.leadId, lead.id))
      .orderBy(desc(leadActivities.createdAt));

    let linkedProduct: any = null;
    if (lead.productId) {
      const p = await this.db
        .select()
        .from(products)
        .where(eq(products.id, lead.productId))
        .limit(1);
      if (p[0]) {
        linkedProduct = { id: p[0].id, name: p[0].title, slug: p[0].slug };
      }
    }

    let linkedUser: any = null;
    if (lead.userId) {
      const u = await this.db
        .select()
        .from(users)
        .where(eq(users.id, lead.userId))
        .limit(1);
      if (u[0]) {
        linkedUser = { id: u[0].id, email: u[0].email, name: u[0].name };
      }
    }

    let wonOrder: any = null;
    if (lead.wonOrderId) {
      const o = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, lead.wonOrderId))
        .limit(1);
      if (o[0]) {
        wonOrder = { orderId: o[0].id, orderNo: o[0].orderNumber };
      }
    }

    const now = new Date();
    const isOverdue =
      !!lead.nextFollowUpAt &&
      lead.nextFollowUpAt < now &&
      !["won", "lost"].includes(lead.status);

    const leadRow: LeadRow = {
      leadId: lead.id,
      source: lead.source as any,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      status: lead.status as any,
      priority: lead.priority as any,
      assignedTo: lead.assignedTo
        ? { id: lead.assignedTo, name: assigneeName ?? null }
        : null,
      productId: lead.productId,
      nextFollowUpAt: lead.nextFollowUpAt
        ? lead.nextFollowUpAt.toISOString()
        : null,
      overdue: isOverdue,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };

    return {
      lead: {
        ...leadRow,
        message: lead.message,
        serviceInterest: lead.serviceInterest,
        budgetHint: lead.budgetHint,
        lostReason: lead.lostReason,
        turnstileVerified: lead.turnstileVerified,
      },
      activities: activities.map((a) => ({
        activityId: a.activity.id,
        kind: a.activity.kind as any,
        actor: a.activity.actorId
          ? { id: a.activity.actorId, name: a.actorName ?? null }
          : null,
        body: a.activity.body,
        meta: (a.activity.meta as Record<string, unknown>) ?? null,
        createdAt: a.activity.createdAt.toISOString(),
      })),
      linkedProduct,
      linkedUser,
      wonOrder,
      conversation: null,
    };
  }

  async assignLead(
    ctx: RequestContext,
    input: AssignLeadInput,
  ): Promise<LeadRow> {
    const [lead] = await this.db
      .update(leads)
      .set({
        assignedTo: input.assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, input.leadId))
      .returning();

    if (!lead) throw new AppError("NOT_FOUND", "Lead not found");

    await this.db.insert(leadActivities).values({
      leadId: lead.id,
      actorId: ctx.userId,
      kind: "assignment",
      body: `Assigned to user ${input.assignedTo}`,
    });

    await notificationsService.emit(
      input.assignedTo,
      "lead.assigned",
      { leadId: lead.id, leadName: lead.name },
      undefined,
      this.db,
    );

    return this.toLeadRow(lead);
  }

  async claimLead(
    ctx: RequestContext,
    input: ClaimLeadInput,
  ): Promise<LeadRow> {
    const existing = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, input.leadId))
      .limit(1);

    if (existing.length === 0) {
      throw new AppError("NOT_FOUND", "Lead not found");
    }

    if (existing[0].assignedTo && existing[0].assignedTo !== ctx.userId) {
      throw new AppError("CONFLICT", "Lead already claimed by another user");
    }

    const [lead] = await this.db
      .update(leads)
      .set({
        assignedTo: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, input.leadId))
      .returning();

    await this.db.insert(leadActivities).values({
      leadId: lead.id,
      actorId: ctx.userId,
      kind: "assignment",
      body: "Lead claimed by user",
    });

    return this.toLeadRow(lead);
  }

  async updateLeadStatus(
    ctx: RequestContext,
    input: UpdateLeadStatusInput,
  ): Promise<LeadRow> {
    const existing = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, input.leadId))
      .limit(1);

    if (existing.length === 0) {
      throw new AppError("NOT_FOUND", "Lead not found");
    }

    const current = existing[0];
    assertValidLeadStatusTransition(
      current.status as any,
      input.status,
      input.lostReason,
      input.wonOrderId,
    );

    const [lead] = await this.db
      .update(leads)
      .set({
        status: input.status,
        lostReason: input.lostReason ?? current.lostReason,
        wonOrderId: input.wonOrderId ?? current.wonOrderId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, input.leadId))
      .returning();

    await this.db.insert(leadActivities).values({
      leadId: lead.id,
      actorId: ctx.userId,
      kind: "status_change",
      body: `Status changed from ${current.status} to ${input.status}${
        input.lostReason ? ` (Reason: ${input.lostReason})` : ""
      }`,
    });

    return this.toLeadRow(lead);
  }

  async addLeadNote(
    ctx: RequestContext,
    input: AddLeadNoteInput,
  ): Promise<LeadActivityRow> {
    const [activity] = await this.db
      .insert(leadActivities)
      .values({
        leadId: input.leadId,
        actorId: ctx.userId,
        kind: "note",
        body: input.body,
      })
      .returning();

    return {
      activityId: activity.id,
      kind: "note",
      actor: { id: ctx.userId, name: null },
      body: activity.body,
      meta: null,
      createdAt: activity.createdAt.toISOString(),
    };
  }

  async setFollowUp(
    ctx: RequestContext,
    input: SetFollowUpInput,
  ): Promise<LeadRow> {
    const nextFollowUpAt = input.nextFollowUpAt
      ? new Date(input.nextFollowUpAt)
      : null;

    const [lead] = await this.db
      .update(leads)
      .set({
        nextFollowUpAt,
        priority: input.priority ?? leads.priority,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, input.leadId))
      .returning();

    if (!lead) throw new AppError("NOT_FOUND", "Lead not found");

    await this.db.insert(leadActivities).values({
      leadId: lead.id,
      actorId: ctx.userId,
      kind: "follow_up_set",
      body: `Follow-up set to ${input.nextFollowUpAt ?? "none"}`,
    });

    return this.toLeadRow(lead);
  }

  async collectOverdueDigest(now: Date): Promise<OverdueDigestForAdmin[]> {
    const overdueLeads = await this.db
      .select({
        lead: leads,
        adminId: users.id,
        email: users.email,
      })
      .from(leads)
      .innerJoin(users, eq(leads.assignedTo, users.id))
      .where(
        and(
          lt(leads.nextFollowUpAt, now),
          notInArray(leads.status, ["won", "lost"]),
        ),
      );

    // Open revoke external tasks
    const openRevokeTasks = await this.db
      .select()
      .from(deliveryTasks)
      .where(
        and(
          eq(deliveryTasks.kind, "revoke_external"),
          eq(deliveryTasks.status, "open"),
        ),
      );



    const digestMap = new Map<string, OverdueDigestForAdmin>();

    for (const row of overdueLeads) {
      if (!digestMap.has(row.adminId)) {
        digestMap.set(row.adminId, {
          adminId: row.adminId,
          email: row.email,
          leads: [],
          revokeTasks: [],
        });
      }
      const daysOverdue = Math.max(
        1,
        Math.floor(
          (now.getTime() - new Date(row.lead.nextFollowUpAt!).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      digestMap.get(row.adminId)!.leads.push({
        leadId: row.lead.id,
        name: row.lead.name,
        nextFollowUpAt: row.lead.nextFollowUpAt!.toISOString(),
        daysOverdue,
      });
    }

    return Array.from(digestMap.values());
  }

  async runOverdueDigestJob(
    job: JobContext,
  ): Promise<JobOutcome<OverdueDigestDetail>> {
    const digests = await this.collectOverdueDigest(job.now);

    let emailsQueued = 0;
    let overdueLeads = 0;

    for (const d of digests) {
      overdueLeads += d.leads.length;
      if (d.leads.length > 0 || d.revokeTasks.length > 0) {
        await notificationsService.emit(
          d.adminId,
          "lead.overdue_digest",
          {
            overdueCount: d.leads.length,
            revokeTasksCount: d.revokeTasks.length,
          },
          ["inapp", "email"],
          this.db,
        );
        emailsQueued++;
      }
    }

    return {
      status: "ok",
      detail: {
        admins: digests.length,
        overdueLeads,
        openRevokeTasks: 0,
        emailsQueued,
      },
    };
  }

  private toLeadRow(lead: Lead): LeadRow {
    const now = new Date();
    const isOverdue =
      !!lead.nextFollowUpAt &&
      lead.nextFollowUpAt < now &&
      !["won", "lost"].includes(lead.status);

    return {
      leadId: lead.id,
      source: lead.source as any,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      status: lead.status as any,
      priority: lead.priority as any,
      assignedTo: lead.assignedTo
        ? { id: lead.assignedTo, name: null }
        : null,
      productId: lead.productId,
      nextFollowUpAt: lead.nextFollowUpAt
        ? lead.nextFollowUpAt.toISOString()
        : null,
      overdue: isOverdue,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createLeadsService(db?: any): LeadsService {
  return new DefaultLeadsService(db);
}

export const leadsService = new DefaultLeadsService();

export function createNotImplementedLeadsService(): LeadsService {
  return createNotImplemented<LeadsService>("leads", "P6", {
    createLead: "async",
    createLeadManual: "async",
    updateLeadStatus: "async",
    assignLead: "async",
    addLeadNote: "async",
    setFollowUp: "async",
    listLeads: "async",
    getLeadDetail: "async",
  });
}
