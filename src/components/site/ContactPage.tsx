import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { Container } from "./Container";
import { InquiryForm, type InquiryFormProps } from "./InquiryForm";
import type { ServiceOption } from "./types";

export interface ContactPageProps {
  serviceOptions: ServiceOption[];
  /** `site_settings.contact_blurbs` */
  trustLines?: string[];
  initialStatus?: InquiryFormProps["initialStatus"];
  onSubmit?: InquiryFormProps["onSubmit"];
}

/**
 * SCR-SITE-09 — 40/60 at lg: copy, trust lines and "Already a customer?" card on the left; the
 * full inquiry form on the right. No email, phone, WhatsApp or social links anywhere (D-808).
 */
export function ContactPage({
  serviceOptions,
  trustLines = ["Fixed-scope proposals", "Indian and international clients", "NDA on request"],
  initialStatus,
  onSubmit,
}: ContactPageProps) {
  return (
    <Container className="py-10 lg:grid lg:grid-cols-5 lg:gap-16 lg:py-16">
      <div className="space-y-8 lg:col-span-2">
        <div className="space-y-4">
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            Contact
          </p>
          <h1 className="font-display text-display-lg text-balance">Start a project</h1>
          <p className="max-w-[45ch] text-body-lg text-fg-muted">
            Tell us what you&rsquo;re building. We reply by email within 2 working days.
          </p>
        </div>
        <ul className="space-y-2.5">
          {trustLines.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-body text-fg">
              <CheckIcon aria-hidden className="mt-1 size-4 shrink-0 text-success" />
              {t}
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-body font-semibold">Already a customer?</p>
          <p className="mt-1 text-body-sm text-fg-muted">
            Sign in and open a query for order help.
          </p>
          <Button asChild variant="link" className="mt-3">
            <Link href="/account/queries">Go to queries →</Link>
          </Button>
        </div>
      </div>
      <div className="mt-10 lg:col-span-3 lg:mt-0">
        <div className="ck-crossfade rounded-xl border border-border bg-surface p-6 shadow-1 lg:p-8">
          <InquiryForm
            variant="full"
            serviceOptions={serviceOptions}
            initialStatus={initialStatus}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </Container>
  );
}
