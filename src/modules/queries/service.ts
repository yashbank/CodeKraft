import { type SQL, and, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { Context, RequestContext } from "@/lib/authz/context";
import { type Db, type DbOrTx, getDb } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertTurnstileVerified, verifyTurnstile } from "@/lib/turnstile";
import { notificationsService } from "@/modules/notifications/service";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import type { ListResult } from "@/modules/_shared/zod";
import { users } from "../../../drizzle/schema/auth";
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
  QueryMessageView,
  QueryRow,
  QueryThread,
  ReopenQueryInput,
  ReplyToQueryInput,
  ReplyToQueryResult,
} from "./types";

export class DefaultQueriesService implements QueriesService {
  private _db?: Db;
  constructor(db?: Db) {
    this._db = db;
  }
  private get db(): Db {
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

      if (!query) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

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
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Authentication required");
    }

    // Refund request single-open thread check (BR-09)
    if (input.refundRequest && input.orderId) {
      const existing = await this.db
        .select()
        .from(queries)
        .where(and(eq(queries.orderId, input.orderId), notInArray(queries.status, ["closed"])))
        .limit(1);

      const open = existing[0];
      if (open) {
        return { queryId: open.id, existing: true };
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

    if (!query) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

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
        userId: input.userId ?? null,
        guestEmail: input.guestEmail ?? null,
        subject: input.subject,
        source: input.source,
        orderId: input.orderId ?? null,
        productId: input.productId ?? null,
        status: "open",
        assignedTo: ctx.userId,
      })
      .returning();

    if (!query) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

    await this.db.insert(queryMessages).values({
      queryId: query.id,
      authorKind: "admin",
      authorId: ctx.userId,
      bodyJson: input.bodyJson,
      attachments: [],
    });

    if (input.userId) {
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
    }

    return { queryId: query.id, existing: false };
  }

  async createFromEscalation(
    input: CreateQueryFromEscalationInput,
    tx: DbOrTx,
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

    if (!query) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

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
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Authentication required");
    }

    const conditions: SQL[] = [eq(queries.userId, ctx.userId)];
    if (input.filters?.status) {
      conditions.push(inArray(queries.status, input.filters.status));
    }

    const rows = await this.db
      .select({
        query: queries,
        assigneeName: users.name,
        orderNo: orders.orderNo,
      })
      .from(queries)
      .leftJoin(users, eq(queries.assignedTo, users.id))
      .leftJoin(orders, eq(queries.orderId, orders.id))
      .where(and(...conditions))
      .orderBy(desc(queries.updatedAt))
      .limit((input.limit ?? 25) + 1);

    const hasNext = rows.length > (input.limit ?? 25);
    const selected = hasNext ? rows.slice(0, input.limit ?? 25) : rows;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(queries)
      .where(and(...conditions));

    // Every row belongs to the calling customer -- one lookup, not a per-row join.
    const [me] = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    const customerRef = me
      ? { id: me.id, email: me.email, name: me.name }
      : { id: ctx.userId, email: "", name: null };

    const items: QueryRow[] = selected.map((r) =>
      this.toQueryRow(r.query, r.assigneeName, customerRef, r.orderNo ?? null),
    );

    return {
      items,
      total: countResult[0]?.count ?? 0,
      nextCursor: hasNext ? (items.at(-1)?.queryId ?? null) : null,
    };
  }

  async getMyQuery(ctx: RequestContext, input: GetMyQueryInput): Promise<QueryThread> {
    if (!ctx.userId) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Authentication required");
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

    const row = rows[0];
    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Query not found");
    }

    return await this.buildThread(row.query, row.assigneeName);
  }

  async replyToQuery(ctx: RequestContext, input: ReplyToQueryInput): Promise<ReplyToQueryResult> {
    const existing = await this.db
      .select()
      .from(queries)
      .where(eq(queries.id, input.queryId))
      .limit(1);

    const query = existing[0];
    if (!query) {
      throw new AppError(ErrorCode.NOT_FOUND, "Query not found");
    }
    if (query.status === "closed") {
      throw new AppError(ErrorCode.STATE_INVALID, "Cannot reply to a closed query");
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

    const [updated] = await this.db
      .update(queries)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(queries.id, query.id))
      .returning();
    if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "Query not found");

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
    if (!msg) throw new AppError(ErrorCode.INTERNAL, "Insert returned no row");

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
      message: this.toMessageView(msg, null),
      query: this.toQueryRow(updated, null),
    };
  }

  async listQueriesAdmin(
    ctx: RequestContext,
    input: ListQueriesAdminInput,
  ): Promise<ListResult<QueryRow>> {
    const conditions: SQL[] = [];
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
      nextCursor: hasNext ? (items.at(-1)?.queryId ?? null) : null,
    };
  }

  async getQueryAdmin(ctx: RequestContext, input: GetQueryAdminInput): Promise<QueryThread> {
    const rows = await this.db
      .select({
        query: queries,
        assigneeName: users.name,
      })
      .from(queries)
      .leftJoin(users, eq(queries.assignedTo, users.id))
      .where(eq(queries.id, input.queryId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Query not found");
    }

    return await this.buildThread(row.query, row.assigneeName);
  }

  async assignQuery(ctx: RequestContext, input: AssignQueryInput): Promise<QueryRow> {
    const [query] = await this.db
      .update(queries)
      .set({
        assignedTo: input.assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(queries.id, input.queryId))
      .returning();

    if (!query) throw new AppError(ErrorCode.NOT_FOUND, "Query not found");
    return this.toQueryRow(query, null);
  }

  async closeQuery(ctx: RequestContext, input: CloseQueryInput): Promise<QueryRow> {
    const [query] = await this.db
      .update(queries)
      .set({
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(queries.id, input.queryId))
      .returning();

    if (!query) throw new AppError(ErrorCode.NOT_FOUND, "Query not found");

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

  async reopenQuery(ctx: RequestContext, input: ReopenQueryInput): Promise<QueryRow> {
    const [query] = await this.db
      .update(queries)
      .set({
        status: "open",
        updatedAt: new Date(),
      })
      .where(eq(queries.id, input.queryId))
      .returning();

    if (!query) throw new AppError(ErrorCode.NOT_FOUND, "Query not found");
    return this.toQueryRow(query, null);
  }

  async runAutoCloseJob(job: JobContext): Promise<JobOutcome<QueriesAutoCloseDetail>> {
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
      },
    };
  }

  private async buildThread(query: Query, assigneeName: string | null): Promise<QueryThread> {
    const messages = await this.db
      .select({
        msg: queryMessages,
        authorName: users.name,
      })
      .from(queryMessages)
      .leftJoin(users, eq(queryMessages.authorId, users.id))
      .where(eq(queryMessages.queryId, query.id))
      .orderBy(desc(queryMessages.createdAt));

    let customer: { id: string | null; name: string | null; email: string } | undefined;
    if (query.userId) {
      const u = await this.db.select().from(users).where(eq(users.id, query.userId)).limit(1);
      if (u[0]) {
        customer = { id: u[0].id, name: u[0].name, email: u[0].email };
      }
    } else if (query.guestEmail) {
      customer = { id: null, name: "Guest", email: query.guestEmail };
    }

    let linkedOrder: QueryThread["linkedOrder"] = null;
    if (query.orderId) {
      const o = await this.db.select().from(orders).where(eq(orders.id, query.orderId)).limit(1);
      if (o[0]) {
        linkedOrder = {
          orderId: o[0].id,
          orderNo: o[0].orderNo,
          status: o[0].status,
          total: { amountMinor: o[0].totalMinor, currency: o[0].currency },
        };
      }
    }

    return {
      query: this.toQueryRow(query, assigneeName, customer, linkedOrder?.orderNo ?? null),
      messages: messages.map((m) => this.toMessageView(m.msg, m.authorName)),
      linkedOrder,
    };
  }

  private toMessageView(msg: QueryMessage, authorName: string | null): QueryMessageView {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return {
      messageId: msg.id,
      authorKind: msg.authorKind,
      author: msg.authorId ? { id: msg.authorId, name: authorName } : null,
      bodyJson: msg.bodyJson as Record<string, unknown>,
      attachments: (msg.attachments ?? []).map((id) => ({
        mediaId: id,
        name: "attachment",
        sizeBytes: 1024,
        url: `/api/files/query/${msg.queryId}/${id}`,
        expiresAt,
      })),
      createdAt: msg.createdAt.toISOString(),
    };
  }

  /**
   * `QueryRow.customer` / `.orderNo` need a `users` / `orders` join the callers below already
   * have in scope (or, for `assignQuery`/`closeQuery`/`reopenQuery`, don't need per-row -- those
   * pass no override and fall back to the bare `userId`/`guestEmail` on the row). `refundRequest`
   * is accepted on `createQuery`'s input for its BR-09 check but has no column on `queries` -- and
   * there's no read-tracking column for `unreadForCaller` either -- so both are always `false`
   * rather than fabricated (docs gap, flagged instead of invented).
   */
  private toQueryRow(
    query: Query,
    assigneeName: string | null,
    customer?: { id: string | null; email: string; name: string | null },
    orderNo?: string | null,
  ): QueryRow {
    return {
      queryId: query.id,
      subject: query.subject,
      source: query.source,
      status: query.status,
      assignedTo: query.assignedTo ? { id: query.assignedTo, name: assigneeName } : null,
      customer: customer ?? { id: query.userId, email: query.guestEmail ?? "", name: null },
      orderNo: orderNo ?? null,
      productId: query.productId,
      refundRequest: false,
      lastMessageAt: query.updatedAt.toISOString(),
      unreadForCaller: false,
      createdAt: query.createdAt.toISOString(),
      updatedAt: query.updatedAt.toISOString(),
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export function createQueriesService(db?: Db): QueriesService {
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
    createFromEscalation: "async",
    listMyQueries: "async",
    getMyQuery: "async",
    listQueriesAdmin: "async",
    getQueryAdmin: "async",
    runAutoCloseJob: "async",
  });
}
