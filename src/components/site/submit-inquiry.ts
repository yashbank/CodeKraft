import { submitLead } from "@/modules/leads/site-actions";

import { TURNSTILE_DEV_TOKEN } from "./TurnstileWidget";
import type { InquirySource } from "./InquiryForm";
import type { InquiryResult, InquiryValues } from "./types";

/**
 * Real submit for `InquiryForm` (/contact + `InquirySheet`): calls the `createLead` Server Action
 * (API-LEAD-01). The same lead path serves product "Request a quote"/customisation (source
 * `product_cta` + `productId`); admins turn the lead into a custom quote. The Turnstile token comes
 * from `TurnstileWidget`; without a site key (dev/test) the mock token is sent, which the
 * server only accepts outside production.
 */
export async function submitInquiry(
  values: InquiryValues,
  source: InquirySource,
  productId?: string,
  turnstileToken: string = TURNSTILE_DEV_TOKEN,
): Promise<InquiryResult> {
  try {
    const res = await submitLead({
      source,
      name: values.name,
      email: values.email,
      phone: values.phone.trim() || undefined,
      company: values.company.trim() || undefined,
      message: values.message,
      serviceInterest: values.serviceInterest ? [values.serviceInterest] : undefined,
      budgetHint: values.budget || undefined,
      productId: source === "product_cta" ? productId : undefined,
      turnstileToken,
    });
    if (!res.ok) return { ok: false, error: res.error.message };
    return { ok: true, reference: res.data.leadId.slice(0, 8).toUpperCase() };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
