/**
 * Admin usage overview for the Chatbot Monitor screen (SCR-ADM-16 "Usage" tab) — no numbered API
 * row of its own; a read composed from `chat_usage_daily` and `conversations` for the admin UI.
 *
 * Known gaps -- see the phase report:
 *  - `estimatedCostInr` and `fallbackRate` are not returned at all: no per-model pricing config
 *    and no fallback-hit flag are stored anywhere, so there is nothing real to compute them from.
 *  - `models` counts CONVERSATIONS per model (each conversation snapshots one model at start),
 *    not raw per-message counts -- there's no per-message model column.
 */
import { gte, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { users } from "../../../drizzle/schema/auth";
import { chatUsageDaily, conversations, knowledgeChunks } from "../../../drizzle/schema/chat";
import { chatCapGuard } from "./caps";

export interface ChatUsageOverview {
  today: number;
  cap: number;
  usersAtCap: number;
  perUserCap: number;
  monthMessages: number;
  escalationRate: number;
  daily: Array<{ label: string; value: number }>;
  topUsers: Array<{ email: string; messages: number; atCap: boolean }>;
  models: Array<{ label: string; value: number }>;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function getChatUsageOverview(
  ctx: RequestContext,
  database: DbOrTx,
): Promise<ChatUsageOverview> {
  assertPermission(ctx, "chat.transcripts.read");

  const rawCaps = await chatCapGuard.caps();
  const caps = { userCap: rawCaps.userDaily, platformCap: rawCaps.platformDaily };
  const today = isoDaysAgo(0);
  const windowStart = isoDaysAgo(29);

  const usageRows = await database
    .select()
    .from(chatUsageDaily)
    .where(gte(chatUsageDaily.day, windowStart));

  const todayRows = usageRows.filter((r) => r.day === today);
  const platformToday = todayRows.find((r) => r.scope === "platform")?.count ?? 0;
  const userRowsToday = todayRows.filter((r) => r.scope !== "platform");
  const usersAtCap = userRowsToday.filter((r) => r.count >= caps.userCap).length;

  const dayList: string[] = [];
  for (let i = 29; i >= 0; i -= 1) dayList.push(isoDaysAgo(i));
  const platformByDay = new Map(
    usageRows.filter((r) => r.scope === "platform").map((r) => [r.day, r.count]),
  );
  const daily = dayList.map((day, i) => ({
    label: `${i + 1}`,
    value: platformByDay.get(day) ?? 0,
  }));
  const monthMessages = daily.reduce((sum, d) => sum + d.value, 0);

  const topUserRows = [...userRowsToday].sort((a, b) => b.count - a.count).slice(0, 5);
  const topUserIds = topUserRows.map((r) => r.scope);
  const topUserEmails =
    topUserIds.length > 0
      ? await database
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.id, topUserIds))
      : [];
  const emailById = new Map(topUserEmails.map((u) => [u.id, u.email]));
  const topUsers = topUserRows.map((r) => ({
    email: emailById.get(r.scope) ?? r.scope,
    messages: r.count,
    atCap: r.count >= caps.userCap,
  }));

  const recentConversations = await database
    .select({ model: conversations.model, escalatedQueryId: conversations.escalatedQueryId })
    .from(conversations)
    .where(gte(conversations.startedAt, new Date(`${windowStart}T00:00:00.000Z`)));

  const escalationRate =
    recentConversations.length > 0
      ? recentConversations.filter((c) => c.escalatedQueryId !== null).length /
        recentConversations.length
      : 0;

  const modelCounts = new Map<string, number>();
  for (const c of recentConversations)
    modelCounts.set(c.model, (modelCounts.get(c.model) ?? 0) + 1);
  const models = [...modelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  return {
    today: platformToday,
    cap: caps.platformCap,
    usersAtCap,
    perUserCap: caps.userCap,
    monthMessages,
    escalationRate,
    daily,
    topUsers,
    models,
  };
}

export interface KnowledgeIndexStatus {
  chunks: number;
  /** Newest `knowledge_chunks.updated_at`, used as a proxy for "last rebuilt" -- there's no
   *  dedicated reindex-run log. Null when the index is empty (never built). */
  lastIndexRun: string | null;
}

export async function getKnowledgeIndexStatus(
  ctx: RequestContext,
  database: DbOrTx,
): Promise<KnowledgeIndexStatus> {
  assertPermission(ctx, "chat.prompts.write");
  const rows = await database
    .select({ updatedAt: knowledgeChunks.updatedAt })
    .from(knowledgeChunks);
  const [first] = rows;
  if (!first) return { chunks: 0, lastIndexRun: null };
  const latest = rows.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), first.updatedAt);
  return { chunks: rows.length, lastIndexRun: latest.toISOString() };
}
