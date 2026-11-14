import { NextRequest, NextResponse } from "next/server";
import { anonymousContext } from "@/lib/authz/context";
import { submitPublicLead } from "@/modules/leads/public-submit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    const error = caught as { message?: string; status?: number };
    console.error("Failed to create lead:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to submit inquiry" },
      { status: error.status || 400 },
    );
  }
}
