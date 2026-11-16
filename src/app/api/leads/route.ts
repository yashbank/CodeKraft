import { NextRequest, NextResponse } from "next/server";
import { anonymousContext } from "@/lib/authz/context";
import { submitPublicLead } from "@/modules/leads/public-submit";

const MAX_BODY_BYTES = 64 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  try {
    // Cap the body before parsing: cheap declared-length check, then the real byte length.
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return fail("Request too large", 413);
    }
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return fail("Request too large", 413);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fail("Invalid request", 400);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("Invalid request", 400);
    }
    const body = parsed as Record<string, string | undefined>;
    // x-forwarded-for: on Vercel the platform overwrites any client-supplied value, so its first
    // entry is the real client IP. Behind a different proxy this would be spoofable.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ctx = anonymousContext({
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    const result = await submitPublicLead(
      {
        source: body.source === "product_cta" ? "product_cta" : "inquiry_form",
        name: body.name,
        email: body.email,
        phone: body.phone || undefined,
        company: body.company || undefined,
        message: body.message,
        serviceInterest: body.serviceInterest ? [body.serviceInterest] : [],
        budgetHint: body.budget || undefined,
        productId: body.productId || undefined,
      },
      ctx,
      ip,
      { honeypot: body.website_url, token: body.formToken },
    );

    if (!result.ok) {
      const status = result.error.code === "RATE_LIMITED" ? 429 : 400;
      return NextResponse.json({ ok: false, error: result.error.message }, { status });
    }
    return NextResponse.json({
      ok: true,
      reference: `CK-L-${result.data.leadId.slice(0, 8).toUpperCase()}`,
      leadId: result.data.leadId,
    });
  } catch (caught) {
    // Detail stays in the server log; the client never sees internal messages.
    console.error("Failed to create lead:", caught);
    return fail("Failed to submit inquiry", 500);
  }
}
