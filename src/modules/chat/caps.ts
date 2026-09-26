import { and, eq, sql } from "drizzle-orm";
import { type TxCtx, getDb } from "@/lib/db";
import { chatUsageDaily } from "../../../drizzle/schema/chat";
import type { ChatCapGuard } from "./contracts";
import type { CapCheck, ChatCaps } from "./types";

export class DefaultChatCapGuard implements ChatCapGuard {
  constructor(
    private readonly userCap = 30,
    private readonly platformCap = 500,
  ) {}

  async caps(): Promise<ChatCaps> {
    return {
      userCap: this.userCap,
      platformCap: this.platformCap,
    };
  }

  async check(userId: string, day: string): Promise<CapCheck> {
    const db = getDb();

    const rows = await db
      .select()
      .from(chatUsageDaily)
      .where(
        and(
          sql`${chatUsageDaily.scope} IN (${userId}, 'platform')`,
          eq(chatUsageDaily.day, day),
        ),
      );

    const userCount = rows.find((r) => r.scope === userId)?.count ?? 0;
    const platformCount = rows.find((r) => r.scope === "platform")?.count ?? 0;

    const remainingUser = Math.max(0, this.userCap - userCount);
    const remainingPlatform = Math.max(0, this.platformCap - platformCount);

    if (userCount >= this.userCap) {
      return {
        allowed: false,
        reason: "user_cap",
        remainingUser: 0,
        remainingPlatform,
      };
    }

    if (platformCount >= this.platformCap) {
      return {
        allowed: false,
        reason: "platform_cap",
        remainingUser,
        remainingPlatform: 0,
      };
    }

    return {
      allowed: true,
      remainingUser,
      remainingPlatform,
    };
  }

  async increment(userId: string, day: string, tx: TxCtx): Promise<void> {
    // User increment
    await tx
      .insert(chatUsageDaily)
      .values({ scope: userId, day, count: 1 })
      .onConflictDoUpdate({
        target: [chatUsageDaily.scope, chatUsageDaily.day],
        set: { count: sql`${chatUsageDaily.count} + 1` },
      });

    // Platform increment
    await tx
      .insert(chatUsageDaily)
      .values({ scope: "platform", day, count: 1 })
      .onConflictDoUpdate({
        target: [chatUsageDaily.scope, chatUsageDaily.day],
        set: { count: sql`${chatUsageDaily.count} + 1` },
      });
  }

  async decrement(userId: string, day: string, tx: TxCtx): Promise<void> {
    await tx
      .update(chatUsageDaily)
      .set({ count: sql`GREATEST(0, ${chatUsageDaily.count} - 1)` })
      .where(
        and(
          sql`${chatUsageDaily.scope} IN (${userId}, 'platform')`,
          eq(chatUsageDaily.day, day),
        ),
      );
  }
}

export const chatCapGuard = new DefaultChatCapGuard();
