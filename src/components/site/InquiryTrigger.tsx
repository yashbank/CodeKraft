"use client";

import { useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

import { InquirySheet, type InquirySheetProps } from "./InquirySheet";

/**
 * A button that owns an `InquirySheet` — the pattern behind every "Start a project",
 * "Discuss this service", "Request customisation" and "Start a similar project" CTA.
 */
export function InquiryTrigger({
  children,
  sheet,
  ...button
}: ButtonProps & {
  children: ReactNode;
  sheet: Omit<InquirySheetProps, "open" | "onOpenChange">;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" {...button} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <InquirySheet open={open} onOpenChange={setOpen} {...sheet} />
    </>
  );
}
