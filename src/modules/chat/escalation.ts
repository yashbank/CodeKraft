/**
 * Escalation helpers — API-CHAT-09, docs/06 §5.6 step 3: the first query message is a system
 * message holding a transcript summary plus the last 10 turns (PHASE-06 P6.7). Pure functions;
 * the service owns the transaction.
 */
import { HISTORY_TURNS } from "./prompt";
import type { ChatRole } from "./types";

export interface TranscriptRow {
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export const ESCALATION_SUBJECT_MAX = 160;
export const EXCERPT_MAX = 20_000;
export const DEFAULT_ESCALATION_SUBJECT = "Chat escalation";

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Subject from the first user message (or the customer's summary), clipped to 160 chars. */
export function defaultEscalationSubject(rows: readonly TranscriptRow[], summary?: string): string {
  const fromSummary = summary?.trim() ?? "";
  if (fromSummary.length >= 3) return clip(fromSummary, ESCALATION_SUBJECT_MAX);
  const firstUser = rows.find((r) => r.role === "user")?.content.trim() ?? "";
  if (firstUser.length >= 3) return clip(`Chat: ${firstUser}`, ESCALATION_SUBJECT_MAX);
  return DEFAULT_ESCALATION_SUBJECT;
}

/** Summary line + the last `HISTORY_TURNS` user/assistant/menu turns, ≤ 20 000 chars. */
export function buildTranscriptExcerpt(
  rows: readonly TranscriptRow[],
  startedAt: Date,
  turns: number = HISTORY_TURNS,
): string {
  const conversational = rows.filter((r) => r.role !== "system");
  const userTurns = conversational.filter((r) => r.role === "user").length;
  const header = `Chatbot conversation started ${startedAt.toISOString()} — ${conversational.length} messages (${userTurns} from the customer).`;
  const recent = conversational.slice(-turns).map((r) => {
    const who = r.role === "user" ? "Customer" : r.role === "assistant" ? "Assistant" : "Menu";
    return `[${who}] ${r.content.trim()}`;
  });
  const body = recent.length === 0 ? "(no messages)" : recent.join("\n");
  const excerpt = `${header}\n\n${body}`;
  return excerpt.length <= EXCERPT_MAX ? excerpt : `${excerpt.slice(0, EXCERPT_MAX - 1)}…`;
}
