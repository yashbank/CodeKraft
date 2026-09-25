/**
 * Daily caps — D-708, docs/04 §9 controls, docs/06 §3.2 pre-flight. `chat_usage_daily` holds one
 * counter per `(scope, day)` where `scope` is a user id or `'platform'`; the day is the IST calendar
 * date (docs/06 §3.3 windows are IST). The user cap is checked first, then the platform cap;
 * counters are incremented before the LLM call and decremented when the provider fails before its
 * first token (`ChatCapGuard` contract).
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { istParts } from "@/lib/dates";
import { chatUsageDaily } from "../../../drizzle/schema/chat";
import type { ChatCapGuard } from "./contracts";
import type { ChatSettingsReader } from "./settings";
import type { CapCheck, ChatCaps, ChatUsage } from "./types";

export const PLATFORM_SCOPE = "platform";

/** `YYYY-MM-DD` in IST for `chat_usage_daily.day`. */
export function usageDay(now: Date = new Date()): string {
  return istParts(now).isoDate;
}

export interface CapGuardDeps {
  db: DbOrTx;
  settings: ChatSettingsReader;
}

async function counts(
  db: DbOrTx,
  userId: string,
  day: string,
): Promise<{ user: number; platform: number }> {
  const rows = await db
    .select({ scope: chatUsageDaily.scope, count: chatUsageDaily.count })
    .from(chatUsageDaily)
    .where(and(eq(chatUsageDaily.day, day), inArray(chatUsageDaily.scope, [userId, PLATFORM_SCOPE])));
  let user = 0;
  let platform = 0;
  for (const r of rows) {
    if (r.scope === PLATFORM_SCOPE) platform = r.count;
    else user = r.count;
  }
  return { user, platform };
}

export function remainingUsage(caps: ChatCaps, used: { user: number; platform: number }): ChatUsage {
  return {
    userRemaining: Math.max(0, caps.userDaily - used.user),
    platformRemaining: Math.max(0, caps.platformDaily - used.platform),
  };
}

export function createChatCapGuard(deps: CapGuardDeps): ChatCapGuard {
  const caps = async (): Promise<ChatCaps> => {
    const s = await deps.settings(deps.db);
    return { userDaily: s.aiDailyUserCap, platformDaily: s.aiDailyPlatformCap };
  };

  return {
    caps,

    async check(userId, day): Promise<CapCheck> {
      const [limits, used] = await Promise.all([caps(), counts(deps.db, userId, day)]);
      const usage = remainingUsage(limits, used);
      if (used.user >= limits.userDaily) return { allowed: false, usage, exceeded: "user" };
      if (used.platform >= limits.platformDaily)
        return { allowed: false, usage, exceeded: "platform" };
      return { allowed: true, usage, exceeded: null };
    },

    async increment(userId, day, tx: TxCtx): Promise<void> {
      await tx
        .insert(chatUsageDaily)
        .values([
          { scope: userId, day, count: 1 },
          { scope: PLATFORM_SCOPE, day, count: 1 },
        ])
        .onConflictDoUpdate({
          target: [chatUsageDaily.scope, chatUsageDaily.day],
          set: { count: sql`${chatUsageDaily.count} + 1` },
        });
    },

    async decrement(userId, day, tx: TxCtx): Promise<void> {
      await tx
        .update(chatUsageDaily)
        .set({ count: sql`greatest(${chatUsageDaily.count} - 1, 0)` })
        .where(and(eq(chatUsageDaily.day, day), inArray(chatUsageDaily.scope, [userId, PLATFORM_SCOPE])));
    },
  };
}

/** Today's platform counter and cap (System widget, transcripts "usage vs caps"). */
export async function platformUsageToday(
  db: DbOrTx,
  settings: ChatSettingsReader,
  now: Date = new Date(),
): Promise<{ platformToday: number; platformCap: number }> {
  const [s, rows] = await Promise.all([
    settings(db),
    db
      .select({ count: chatUsageDaily.count })
      .from(chatUsageDaily)
      .where(and(eq(chatUsageDaily.day, usageDay(now)), eq(chatUsageDaily.scope, PLATFORM_SCOPE))),
  ]);
  return { platformToday: rows[0]?.count ?? 0, platformCap: s.aiDailyPlatformCap };
}

/** Both counters for the transcript view (API-CHAT-11 "usage vs caps"). */
export async function usageForUser(
  db: DbOrTx,
  settings: ChatSettingsReader,
  userId: string,
  now: Date = new Date(),
): Promise<{ userToday: number; userCap: number; platformToday: number; platformCap: number }> {
  const [s, used] = await Promise.all([settings(db), counts(db, userId, usageDay(now))]);
  return {
    userToday: used.user,
    userCap: s.aiDailyUserCap,
    platformToday: used.platform,
    platformCap: s.aiDailyPlatformCap,
  };
}
