"use client";

import { ArrowDownIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { Container } from "../Container";
import { InquirySheet } from "../InquirySheet";
import type { LandingContent, ServiceOption } from "../types";
import { HeroPoster } from "./HeroPoster";

/** Stored CTA target that opens the inquiry sheet instead of navigating. */
const INQUIRY_HREF = "/contact#inquiry";

/**
 * Hero / chapter 01 "Who we are" (docs/08 §6.5): overline, display-xl h1 with gradient on the
 * last two words, lede, `primary xl` "Start a project" (opens the InquirySheet) + `secondary xl`
 * "Explore products", scroll cue. Text sits on solid canvas; the poster/scene never
 * carries contrast.
 */
export function LandingHero({
  content,
  serviceOptions,
}: {
  content: LandingContent["who"];
  serviceOptions: ServiceOption[];
}) {
  const [open, setOpen] = useState(false);
  const primary = content.cta?.primary ?? { label: "Start a project", href: INQUIRY_HREF };
  // Never-set content shows the default; once saved, an empty secondary hides the button.
  const secondary = content.cta
    ? content.cta.secondary?.label && content.cta.secondary.href
      ? content.cta.secondary
      : null
    : { label: "Explore products", href: "/products" };
  const words = content.title.split(" ");
  const head = words.slice(0, -2).join(" ");
  const tail = words.slice(-2).join(" ");
  return (
    <section id="who" aria-labelledby="who-title" className="relative scroll-mt-16 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[image:var(--ck-gradient-glow)] opacity-60"
      />
      <Container className="relative grid gap-10 pt-24 pb-16 lg:min-h-svh lg:grid-cols-12 lg:items-center lg:gap-8 lg:pt-16 lg:pb-24">
        <div className="space-y-6 lg:col-span-6">
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            {content.eyebrow}
          </p>
          <h1 id="who-title" className="font-display text-display-xl text-balance text-fg">
            {head}{" "}
            <span className="bg-[image:var(--ck-gradient-brand)] bg-clip-text text-transparent">
              {tail}
            </span>
          </h1>
          <p className="max-w-[55ch] text-body-lg text-fg-muted">{content.subtitle}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {primary.href === INQUIRY_HREF ? (
              <Button
                type="button"
                size="xl"
                className="w-full sm:w-auto"
                onClick={() => setOpen(true)}
              >
                {primary.label}
              </Button>
            ) : (
              <Button asChild size="xl" className="w-full sm:w-auto">
                <Link href={primary.href}>{primary.label}</Link>
              </Button>
            )}
            {secondary ? (
              <Button asChild variant="secondary" size="xl" className="w-full sm:w-auto">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="lg:col-span-6 lg:h-[min(70svh,720px)]">
          <HeroPoster
            src={content.poster?.url}
            alt={content.poster?.alt}
            nodeLabel={content.nodeLabel}
            nodeStyle={content.nodeStyle}
          />
        </div>
        <a
          href="#build"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1 text-caption text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:animate-bounce lg:inline-flex"
        >
          <ArrowDownIcon aria-hidden className="size-4" /> Scroll
        </a>
      </Container>
      <InquirySheet open={open} onOpenChange={setOpen} serviceOptions={serviceOptions} />
    </section>
  );
}
