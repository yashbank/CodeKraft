/**
 * Server side of chat + query attachments (P14-06): validate ids a user wants to attach, build
 * the views threads render, and decide who may read an attachment. Files live in the private
 * bucket (media purpose `chat_attachment`); bytes are only ever served by
 * GET /api/files/attachment/[mediaId], never by a public URL.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { can } from "@/lib/authz/assert";
import type { Context } from "@/lib/authz/context";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIMES,
  attachmentUrl,
  validateAttachmentCount,
  type AttachmentView,
} from "@/lib/attachments";
import type { Db } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { chatMessages } from "../../../drizzle/schema/chat";
import { media, type Media } from "../../../drizzle/schema/media";
import { queries, queryMessages } from "../../../drizzle/schema/queries";

export function toAttachmentView(m: Media): AttachmentView {
  return {
    mediaId: m.id,
    name: m.originalName ?? "attachment",
    mime: m.mime,
    sizeBytes: m.sizeBytes,
    url: attachmentUrl(m.id),
  };
}

/** Views for already-attached media ids (no authz: the caller loaded the parent thread under authz). */
export async function loadAttachmentViews(
  db: Db,
  ids: readonly string[],
): Promise<Map<string, AttachmentView>> {
  const out = new Map<string, AttachmentView>();
  if (ids.length === 0) return out;
  const rows = await db
    .select()
    .from(media)
    .where(inArray(media.id, [...new Set(ids)]));
  for (const r of rows) out.set(r.id, toAttachmentView(r));
  return out;
}

/**
 * The ids a sender wants to attach must be their own completed private chat_attachment uploads:
 * count <= 5, unique, within the type allow-list and size cap. Throws VALIDATION otherwise.
 */
export async function resolveOwnAttachments(
  db: Db,
  userId: string | null,
  ids: readonly string[],
): Promise<Media[]> {
  if (ids.length === 0) return [];
  const countErr = validateAttachmentCount(ids.length);
  if (countErr) throw new AppError(ErrorCode.VALIDATION, countErr);
  if (!userId || new Set(ids).size !== ids.length)
    throw new AppError(ErrorCode.VALIDATION, "Invalid attachments");
  const rows = await db
    .select()
    .from(media)
    .where(inArray(media.id, [...ids]));
  const ok = (m: Media) =>
    m.uploadedBy === userId &&
    m.visibility === "private" &&
    ATTACHMENT_MIMES.includes(m.mime) &&
    m.sizeBytes <= ATTACHMENT_MAX_BYTES;
  if (rows.length !== ids.length || !rows.every(ok))
    throw new AppError(ErrorCode.VALIDATION, "One or more attachments are not valid");
  return ids.flatMap((id) => rows.find((r) => r.id === id) ?? []);
}

export interface AttachmentLinks {
  uploadedByCaller: boolean;
  /** Referenced by a message of a query the caller owns. */
  inOwnQuery: boolean;
  inAnyQuery: boolean;
  inAnyChat: boolean;
}

/** Pure decision: uploader, owning customer, or an admin holding the matching read permission. */
export function mayReadAttachment(ctx: Context, l: AttachmentLinks): boolean {
  if (!ctx.userId) return false;
  if (l.uploadedByCaller || l.inOwnQuery) return true;
  return (
    (l.inAnyQuery && can(ctx, "queries.read")) || (l.inAnyChat && can(ctx, "chat.transcripts.read"))
  );
}

/** Loads the media row if (and only if) the caller may read it; NOT_FOUND hides existence. */
export async function getReadableAttachment(db: Db, ctx: Context, mediaId: string): Promise<Media> {
  const notFound = new AppError(ErrorCode.NOT_FOUND, "Attachment not found");
  if (!ctx.userId) throw notFound;
  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row || row.visibility !== "private" || !ATTACHMENT_MIMES.includes(row.mime)) throw notFound;

  const inQuery = sql`${mediaId}::uuid = any(${queryMessages.attachments})`;
  const [own] = await db
    .select({ id: queryMessages.id })
    .from(queryMessages)
    .innerJoin(queries, eq(queries.id, queryMessages.queryId))
    .where(and(inQuery, eq(queries.userId, ctx.userId)))
    .limit(1);
  const [anyQ] = await db
    .select({ id: queryMessages.id })
    .from(queryMessages)
    .where(inQuery)
    .limit(1);
  const [anyC] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(sql`${mediaId}::uuid = any(${chatMessages.attachments})`)
    .limit(1);

  const allowed = mayReadAttachment(ctx, {
    uploadedByCaller: row.uploadedBy === ctx.userId,
    inOwnQuery: !!own,
    inAnyQuery: !!anyQ,
    inAnyChat: !!anyC,
  });
  if (!allowed) throw notFound;
  return row;
}
