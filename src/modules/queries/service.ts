import { and, desc, eq, gt, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { type TxCtx, getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertTurnstileVerified, verifyTurnstile } from "@/lib/turnstile";
import { notificationsService } from "@/modules/notifications/service";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
import { users } from "../../../drizzle/schema/auth";
import { products } from "../../../drizzle/schema/catalog";
import { orders } from "../../../drizzle/schema/commerce";
import {
  type Query,
  type QueryMessage,
  queries,
  queryMessages,
} from "../../../drizzle/schema/queries";
import type { QueriesService } from "./contracts";
import type {
  AssignQueryInput,
  CloseQueryInput,
  CreateQueryAdminInput,
  CreateQueryFromEscalationInput,
  CreateQueryInput,
  GetMyQueryInput,
  GetQueryAdminInput,
  ListMyQueriesInput,
  ListQueriesAdminInput,
  QueriesAutoCloseDetail,
  QueryCreateResult,
  QueryRow,
  QueryThread,
  ReopenQueryInput,
  ReplyToQueryInput,
  ReplyToQueryResult,
} from "./types";

export class DefaultQueriesService implements QueriesService {
  private _db?: any;
  constructor(db?: any) {
    this._db = db;
  }
  private get db(): any {
    return this._db ?? getDb();
  }

  async createQuery(ctx: Context, input: CreateQueryInput): Promise<QueryCreateResult> {
    if (input.guestEmail) {
      const turnstileRes = await verifyTurnstile(input.turnstileToken ?? "");
      assertTurnstileVerified(turnstileRes);

      const [query] = await this.db
        .insert(queries)
        .values({
          subject: input.subject,
          source: "form",
          guestEmail: input.guestEmail,
          productId: input.productId ?? null,
          status: "open",
        })
        .returning();

      await this.db.insert(queryMessages).values({
        queryId: query.id,
        authorKind: "customer",
        authorId: null,
        bodyJson: input.bodyJson,
        attachments: input.attachments ?? [],
      });

      await notificationsService.emit(
        "admins",
        "query.new",
        {
          queryId: query.id,
          subject: query.subject,
          guestEmail: query.guestEmail,
          preview: "New guest query submitted",
        },
        undefined,
        this.db,
      );

      return { queryId: query.id, existing: false };
    }

    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    // Refund request single-open thread check (BR-09)
    if (input.refundRequest && input.orderId) {
      const existing = await this.db
        .select()
        .from(queries)
        .where(
          and(
            eq(queries.orderId, input.orderId),
            notInArray(queries.status, ["closed"]),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return { queryId: existing[0].id, existing: true };
      }
    }

    const [query] = await this.db
      .insert(queries)
      .values({
        userId: ctx.userId,
        subject: input.subject,
        source: input.source,
        orderId: input.orderId ?? null,
        productId: input.productId ?? null,
        status: "open",
      })
      .returning();

    await this.db.insert(queryMessages).values({
      queryId: query.id,
      authorKind: "customer",
      authorId: ctx.userId,
      bodyJson: input.bodyJson,
      attachments: input.attachments ?? [],
    });

    await notificationsService.emit(
      "admins",
      "query.new",
      {
        queryId: query.id,
        subject: query.subject,
        preview: "New query from customer",
      },
      undefined,
      this.db,
    );

    return { queryId: query.id, existing: false };
  }

  async createQueryAdmin(
    ctx: RequestContext,
    input: CreateQueryAdminInput,
  ): Promise<QueryCreateResult> {
    const [query] = await this.db
      .insert(queries)
      .values({
        userId: input.userId,
        subject: input.subject,
        source: input.source,
        orderId: input.orderId ?? null,
        productId: input.productId ?? null,
        status: "open",
        assignedTo: ctx.userId,
      })
      .returning();

    await this.db.insert(queryMessages).values({
      queryId: query.id,
      authorKind: "admin",
      authorId: ctx.userId,
      bodyJson: input.bodyJson,
      attachments: input.attachments ?? [],
    });

    await notificationsService.emit(
      input.userId,
      "query.new",
      {
        queryId: query.id,
        subject: query.subject,
        preview: "New query opened by support",
      },
      ["inapp", "email"],
      this.db,
    );

    return { queryId: query.id, existing: false };
  }

  async createFromEscalation(
    input: CreateQueryFromEscalationInput,
    tx: TxCtx,
  ): Promise<QueryCreateResult> {
    const [query] = await tx
      .insert(queries)
      .values({
        userId: input.userId,
        subject: input.subject ?? "Support Inquiry (Escalated from Chat)",
        source: "chatbot",
        conversationId: input.conversationId,
        status: "open",
      })
      .returning();

    await tx.insert(queryMessages).values({
      queryId: query.id,
      authorKind: "system",
      authorId: null,
      bodyJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            text: `Conversation escalated from AI chat. Excerpt:\n${input.transcriptExcerpt ?? ""}`,
          },
        ],
      },
      attachments: [],
    });

    await notificationsService.emit(
      "admins",
      "query.new",
      {
        queryId: query.id,
        subject: query.subject,
        preview: "Escalated from chatbot",
      },
      undefined,
      tx,
    );

    return { queryId: query.id, existing: false };
  }

  async listMyQueries(
    ctx: RequestContext,
    input: ListMyQueriesInput,
  ): Promise<ListResult<QueryRow>> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    const conditions: any[] = [eq(queries.userId, ctx.userId)];
    if (input.filters?.status) {
      conditions.push(inArray(queries.status, input.filters.status));
    }

    const rows = await this.db
      .select({
        query: queries,
        assigneeName: users.name,
      })
      .from(queries)
      .leftJoin(users, eq(queries.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(desc(queries.updatedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(queries)
      .where(and(...conditions));

    const items: QueryRow[] = selected.map((r) => this.toQueryRow(r.query, r.assigneeName));

    return {
      items,
      total: countResult[0]?.count ?? 0,
      nextCursor: hasNext ? items[items.length - 1].queryId : null,
    };
  }

  async getMyQuery(ctx: RequestContext, input: GetMyQueryInput): Promise<QueryThread> {
    if (!ctx.userId) {
      throw new AppError("UNAUTHORIZED", "Authentication required");
    }

    const rows = await this.db
      .select({
        query: queries,
        assigneeName: users.name,
      })
      .from(queries)
      .leftJoin(users, eq(queries.assignedTo, users.id))
      .where(and(eq(queries.id, input.queryId), eq(queries.userId, ctx.userId)))
      .limit(1);

    if (rows.length === 0) {
      throw new AppError("NOT_FOUND", "Query not found");
    }

    return await this.buildThread(rows[0].query, rows[0].assigneeName);
  }

  async replyToQuery(
    ctx: RequestContext,
    input: ReplyToQueryInput,
  ): Promise<ReplyToQueryResult> {
    const existing = await this.db
      .select()
      .from(queries)
      .where(eq(queries.id, input.queryId))
      .limit(1);

    if (existing.length === 0) {
      throw new AppError("NOT_FOUND", "Query not found");
    }

    const query = existing[0];
    if (query.status === "closed") {
      throw new AppError("STATE_INVALID", "Cannot reply to a closed query");
    }

    const isAdmin = ctx.roles.some((r) => ["admin", "super_admin"].includes(r));
    const isCustomer = !isAdmin;

    let nextStatus = query.status;

    if (isCustomer) {
      if (input.setStatus === "resolved") {
        nextStatus = "resolved";
      } else if (query.status === "waiting_customer") {
        nextStatus = "open";
      } else if (query.status === "resolved") {
        // Customer reopening within 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (query.updatedAt >= sevenDaysAgo) {
          nextStatus = "open";
        }
      }
    } else {
      nextStatus = input.setStatus ?? "waiting_customer";
    }

    await this.db
      .update(queries)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(queries.id, query.id));

    const [msg] = await this.db
      .insert(queryMessages)
      .values({
        queryId: query.id,
        authorKind: isAdmin ? "admin" : "customer",
        authorId: ctx.userId,
        bodyJson: input.bodyJson,
        attachments: input.attachments ?? [],
      })
      .returning();

    if (isAdmin && query.userId) {
      await notificationsService.emit(
        query.userId,
        "query.replied",
        {
          queryId: query.id,
          subject: query.subject,
        },
        ["inapp", "email"],
        this.db,
      );
    } else if (isCustomer) {
      const target = query.assignedTo ?? "admins";
      await notificationsService.emit(
        target,
        "query.customer_replied",
        {
          queryId: query.id,
          subject: query.subject,
        },
        undefined,
        this.db,
      );
    }

    return {
      messageId: msg.id,
      status: nextStatus as any,
    };
  }

  async listQueriesAdmin(
    ctx: RequestContext,
    input: ListQueriesAdminInput,
  ): Promise<ListResult<QueryRow>> {
    const conditions: any[] = [];
    if (input.filters?.status) {
      conditions.push(inArray(queries.status, input.filters.status));
    }
    if (input.filters?.assignedTo) {
      if (input.filters.assignedTo === "me") {
        conditions.push(eq(queries.assignedTo, ctx.userId));
      } else if (input.filters.assignedTo === "unassigned") {
        conditions.push(isNull(queries.assignedTo));
      } else {
        conditions.push(eq(queries.assignedTo, input.filters.assignedTo));
      }
    }

    const rows = await this.db
      .select({
        query: queries,
        assigneeName: users.name,
      })
      .from(queries)
      .leftJoin(users, eq(queries.assignedTo, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(queries.updatedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(queries)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const items: QueryRow[] = selected.map((r) => this.toQueryRow(r.query, r.assigneeName));

    return {
      items,
      total: countResult[0]?.count ?? 0,
      nextCursor: hasNext ? items[items.length - 1].queryId : null,
    };
  }

  async getQueryAdmin(
    ctx: RequestContext,
    input: GetQueryAdminInput,
  ): Promise<QueryThread> {
    const rows = await this.db
      .select({
        query: queries,
        assigneeName: users.name,
      })
      .from(queries)
      .leftJoin(users, eq(queries.assignedTo, users.id))
      .where(eq(queries.id, input.queryId))
      .limit(1);

    if (rows.length === 0) {
      throw new AppError("NOT_FOUND", "Query not found");
    }

    return await this.buildThread(rows[0].query, rows[0].assigneeName);
  }

  async assignQuery(
    ctx: RequestContext,
    input: AssignQueryInput,
  ): Promise<QueryRow> {
    const [query] = await this.db
      .update(queries)
      .set({
        assignedTo: input.assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(queries.id, input.queryId))
      .returning();

    if (!query) throw new AppError("NOT_FOUND", "Query not found");
    return this.toQueryRow(query, null);
  }

  async closeQuery(
    ctx: RequestContext,
    input: CloseQueryInput,
  ): Promise<QueryRow> {
    const [query] = await this.db
      .update(queries)
      .set({
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(queries.id, input.queryId))
      .returning();

    if (!query) throw new AppError("NOT_FOUND", "Query not found");

    if (query.userId) {
      await notificationsService.emit(
        query.userId,
        "query.replied",
        {
          queryId: query.id,
          subject: query.subject,
        },
        ["inapp", "email"],
        this.db,
      );
    }

    return this.toQueryRow(query, null);
  }

  async reopenQuery(
    ctx: RequestContext,
    input: ReopenQueryInput,
  ): Promise<QueryRow> {
    const [query] = await this.db
      .update(queries)
      .set({
        status: "open",
        updatedAt: new Date(),
      })
      .where(eq(queries.id, input.queryId))
      .returning();

    if (!query) throw new AppError("NOT_FOUND", "Query not found");
    return this.toQueryRow(query, null);
  }

  async runAutoCloseJob(
    job: JobContext,
  ): Promise<JobOutcome<QueriesAutoCloseDetail>> {
    const sevenDaysAgo = new Date(job.now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const candidates = await this.db
      .select()
      .from(queries)
      .where(
        and(
          inArray(queries.status, ["waiting_customer", "resolved"]),
          lt(queries.updatedAt, sevenDaysAgo),
        ),
      );

    let closed = 0;
    for (const q of candidates) {
      await this.db
        .update(queries)
        .set({ status: "closed", updatedAt: job.now })
        .where(eq(queries.id, q.id));

      if (q.userId) {
        await notificationsService.emit(
          q.userId,
          "query.replied",
          { queryId: q.id, subject: q.subject },
          ["inapp", "email"],
          this.db,
        );
      }
      closed++;
    }

    return {
      status: "ok",
      detail: {
        scanned: candidates.length,
        closed,
        jobId: job.jobId,
      },
    };
  }

  private async buildThread(
    query: Query,
    assigneeName: string | null,
  ): Promise<QueryThread> {
    const messages = await this.db
      .select({
        msg: queryMessages,
        authorName: users.name,
      })
      .from(queryMessages)
      .leftJoin(users, eq(queryMessages.authorId, users.id))
      .where(eq(queryMessages.queryId, query.id))
      .orderBy(desc(queryMessages.createdAt));

    let customer: any = null;
    if (query.userId) {
      const u = await this.db
        .select()
        .from(users)
        .where(eq(users.id, query.userId))
        .limit(1);
      if (u[0]) {
        customer = { id: u[0].id, name: u[0].name, email: u[0].email };
      }
    } else if (query.guestEmail) {
      customer = { id: null, name: "Guest", email: query.guestEmail };
    }

    let linkedOrder: any = null;
    if (query.orderId) {
      const o = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, query.orderId))
        .limit(1);
      if (o[0]) {
        linkedOrder = { orderId: o[0].id, orderNo: o[0].orderNumber };
      }
    }

    let linkedProduct: any = null;
    if (query.productId) {
      const p = await this.db
        .select()
        .from(products)
        .where(eq(products.id, query.productId))
        .limit(1);
      if (p[0]) {
        linkedProduct = { id: p[0].id, name: p[0].title, slug: p[0].slug };
      }
    }

    return {
      query: this.toQueryRow(query, assigneeName),
      messages: messages.map((m) => ({
        messageId: m.msg.id,
        authorKind: m.msg.authorKind as any,
        author: m.msg.authorId ? { id: m.msg.authorId, name: m.authorName ?? null } : null,
        bodyJson: m.msg.bodyJson as any,
        attachments: (m.msg.attachments ?? []).map((id) => ({
          mediaId: id,
          filename: "attachment",
          mime: "application/octet-stream",
          sizeBytes: 1024,
          url: `/api/files/query/${query.id}/${id}`,
        })),
        createdAt: m.msg.createdAt.toISOString(),
      })),
      customer,
      linkedOrder,
      linkedProduct,
      originatingConversation: query.conversationId
        ? { conversationId: query.conversationId, escalatedQueryId: query.id }
        : null,
    };
  }

  private toQueryRow(query: Query, assigneeName: string | null): QueryRow {
    return {
      queryId: query.id,
      subject: query.subject,
      source: query.source as any,
      status: query.status as any,
      guestEmail: query.guestEmail,
      orderId: query.orderId,
      productId: query.productId,
      assignedTo: query.assignedTo ? { id: query.assignedTo, name: assigneeName } : null,
      messageCount: 1,
      lastMessageAt: query.updatedAt.toISOString(),
      createdAt: query.createdAt.toISOString(),
      updatedAt: query.updatedAt.toISOString(),
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createQueriesService(db?: any): QueriesService {
  return new DefaultQueriesService(db);
}

export const queriesService = new DefaultQueriesService();

export function createNotImplementedQueriesService(): QueriesService {
  return createNotImplemented<QueriesService>("queries", "P6", {
    createQuery: "async",
    createQueryAdmin: "async",
    replyToQuery: "async",
    assignQuery: "async",
    closeQuery: "async",
    reopenQuery: "async",
    listQueries: "async",
    getQueryDetail: "async",
  });
}
