import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";
import { Wordmark } from "./Wordmark";

/**
 * Auth split layout — SCR-AUTH-01 §Layout: 45% brand panel (gradient glow + tagline, no 3D) and a
 * centred card. Below `lg` the panel collapses to a slim band with the wordmark.
 */
export function AuthLayout({
  tagline = "Buy once, build forever.",
  children,
  variant = "customer",
}: {
  tagline?: string;
  children: ReactNode;
  /** `admin` drops the marketing panel: plain canvas, centred card (SCR-ADM-01). */
  variant?: "customer" | "admin";
}) {
  if (variant === "admin") {
    return (
      <main className="flex min-h-[calc(100dvh-3rem)] items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    );
  }
  return (
    <main className="grid min-h-[calc(100dvh-3rem)] bg-canvas lg:grid-cols-[45fr_55fr]">
      <aside
        aria-label="CodeKraft"
        className="relative flex items-center justify-between overflow-hidden border-b border-border bg-surface px-4 py-3 lg:flex-col lg:items-start lg:justify-between lg:border-r lg:border-b-0 lg:px-12 lg:py-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 size-[420px] rounded-full bg-[image:var(--ck-gradient-brand)] opacity-25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-120px] bottom-[-160px] size-[380px] rounded-full bg-accent-soft opacity-60 blur-3xl"
        />
        <Wordmark className="relative" />
        <p className="relative hidden max-w-sm font-display text-display-lg text-fg lg:block">
          {tagline}
        </p>
        <p className="relative hidden text-caption text-fg-subtle lg:block">
          Products, services and support in one account.
        </p>
      </aside>
      <div className="flex items-start justify-center px-4 py-8 sm:items-center lg:py-12">
        <div className="w-full max-w-[420px] 2xl:max-w-[460px]">{children}</div>
      </div>
    </main>
  );
}

/** Card body for auth forms: h1 + optional lede, 48px controls on phone. */
export function AuthCard({
  title,
  lede,
  children,
  className,
  headingId = "auth-title",
}: {
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
  headingId?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2 sm:p-8",
        className,
      )}
    >
      <div className="space-y-1.5">
        <h1 id={headingId} tabIndex={-1} className="text-h2 text-fg outline-none">
          {title}
        </h1>
        {lede ? <p className="text-body-sm text-fg-muted">{lede}</p> : null}
      </div>
      {children}
    </section>
  );
}
