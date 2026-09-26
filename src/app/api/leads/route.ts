import { NextRequest, NextResponse } from "next/server";
import { leadsService } from "@/modules/leads";
import { anonymousContext } from "@/lib/authz/context";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = anonymousContext({
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    const result = await leadsService.createLead(ctx, {
      source: body.source === "product_cta" ? "product_cta" : "inquiry_form",
      name: body.name,
      email: body.email,
      phone: body.phone || undefined,
      company: body.company || undefined,
      message: body.message,
      serviceInterest: body.serviceInterest ? [body.serviceInterest] : [],
      budgetHint: body.budget || undefined,
      productId: body.productId || undefined,
      turnstileToken: body.turnstileToken || "test-bypass-token",
    });

    return NextResponse.json({
      ok: true,
      reference: `CK-L-${result.leadId.slice(0, 8).toUpperCase()}`,
      leadId: result.leadId,
    });
  } catch (error: any) {
    console.error("Failed to create lead:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to submit inquiry",
      },
      { status: error.status || 400 }
    );
  }
}
