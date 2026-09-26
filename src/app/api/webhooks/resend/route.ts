/**
 * POST /api/webhooks/resend — docs/06 §3.4, PHASE-06 P6.1.
 * Webhook handler for Resend delivery/bounce/complaint events.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { webhookEvents } from "../../../../../drizzle/schema/ops";
import { emailOutbox } from "../../../../../drizzle/schema/notifications";
import { customerProfiles } from "../../../../../drizzle/schema/users-ext";
import { users } from "../../../../../drizzle/schema/auth";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody || "{}");
    const eventId = payload.id ?? `event-${Date.now()}`;
    const eventType = payload.type ?? "email.delivered"; // e.g. email.delivered, email.bounced, email.complained
    const toEmail = payload.data?.to?.[0] ?? payload.data?.to;

    const db = getDb();

    // Check webhook_events idempotency
    const existing = await db
      .select()
      .from(webhookEvents)
      .where(and(eq(webhookEvents.provider, "resend"), eq(webhookEvents.eventId, eventId)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    // Insert into webhook_events
    await db.insert(webhookEvents).values({
      provider: "resend",
      eventId,
      payload,
      processedAt: new Date(),
    });

    // Handle bounces / complaints
    if (eventType === "email.bounced" || eventType === "email.complained") {
      if (toEmail) {
        const u = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, toEmail))
          .limit(1);

        if (u.length > 0 && u[0]) {
          await db
            .update(customerProfiles)
            .set({
              notificationPrefs: { email: false, inapp: true },
              updatedAt: new Date(),
            })
            .where(eq(customerProfiles.userId, u[0].id));
        }
      }
    }

    // Update email_outbox if delivery event
    if (toEmail && (eventType === "email.delivered" || eventType === "email.bounced")) {
      await db
        .update(emailOutbox)
        .set({
          status: eventType === "email.delivered" ? "sent" : "failed",
          lastError: eventType === "email.bounced" ? "Bounced" : null,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.toEmail, toEmail));
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Resend webhook error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
