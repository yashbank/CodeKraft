"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { InquiryForm, type InquiryFormProps, type InquirySource } from "./InquiryForm";
import type { InquiryValues, ServiceOption } from "./types";

export interface InquirySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOptions: ServiceOption[];
  source?: InquirySource;
  /** Sheet heading; defaults per source ("Start a project" / "Request customisation"). */
  title?: string;
  description?: string;
  defaults?: Partial<InquiryValues>;
  onSubmit?: InquiryFormProps["onSubmit"];
}

/**
 * Shared inquiry sheet (docs/08 §6.10; SCR-SITE-01/02/04/06/08). Right sheet at lg+, full-width
 * drawer below. Posts to the same `createLead` action as /contact. Focus is trapped and returns
 * to the trigger (Radix Dialog semantics).
 */
export function InquirySheet({
  open,
  onOpenChange,
  serviceOptions,
  source = "inquiry_form",
  title,
  description,
  defaults,
  onSubmit,
}: InquirySheetProps) {
  const heading = title ?? (source === "product_cta" ? "Request customisation" : "Start a project");
  const sub =
    description ??
    (source === "product_cta"
      ? "Tell us your requirements; we'll send a private quote."
      : "Tell us about your project — we reply by email within 2 working days.");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto lg:w-[560px] 2xl:w-[640px]">
        <SheetHeader className="pb-0">
          <SheetTitle>{heading}</SheetTitle>
          <SheetDescription>{sub}</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          {open ? (
            <InquiryForm
              key={JSON.stringify(defaults ?? {})}
              variant="compact"
              source={source}
              serviceOptions={serviceOptions}
              defaults={defaults}
              onSubmit={onSubmit}
              onDone={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
