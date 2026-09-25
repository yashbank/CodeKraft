"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { InquirySheet } from "./InquirySheet";
import { SITE_NAV } from "./nav";
import { ThemeToggle } from "./ThemeToggle";
import type { ServiceOption } from "./types";
import { Wordmark } from "./Wordmark";

export interface SiteHeaderProps {
  /** Options for the inquiry sheet's "What do you need?" select. */
  serviceOptions: ServiceOption[];
  /** Transparent over the landing hero until scrolled 80 px (docs/07 §3.1). */
  transparentAtTop?: boolean;
  /** Feature flag `theme_light_editorial` (hidden at release 1). */
  themeToggleEnabled?: boolean;
  /** Overrides the active-link detection (previews render outside the real routes). */
  currentPath?: string;
}

/**
 * Site header — docs/07 §3.1, docs/08 §6.4. Sticky glass bar (transparent over the landing hero),
 * centre nav at lg+, "Sign in" + "Start a project" on the right, hamburger → right Sheet below lg.
 * The Products compact panel (categories + featured minis) is a P7 item; here it is a plain link.
 */
export function SiteHeader({
  serviceOptions,
  transparentAtTop = false,
  themeToggleEnabled = false,
  currentPath,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const active = currentPath ?? pathname;
  const [scrolled, setScrolled] = useState(!transparentAtTop);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  useEffect(() => {
    if (!transparentAtTop) return;
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentAtTop]);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-(--ck-z-skip) rounded-md bg-accent px-3 py-2 text-body-sm font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className={cn(
          "sticky top-(--site-header-top,0px) z-(--ck-z-header) w-full transition-[background-color,border-color,backdrop-filter] duration-(--ck-motion-duration-md) ease-standard",
          scrolled
            ? "border-b border-border bg-glass backdrop-blur-header backdrop-saturate-[var(--ck-glass-saturate)]"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:h-16 lg:px-8 2xl:max-w-[1440px] tv:h-20 tv:max-w-[1920px] tv:px-24">
          <Link
            href="/"
            className="rounded-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            aria-label="CodeKraft home"
          >
            <Wordmark className="h-5 lg:h-6 tv:h-8" />
          </Link>

          <nav aria-label="Primary" className="ml-6 hidden lg:block">
            <ul className="flex items-center gap-1">
              {SITE_NAV.map((item) => {
                const isActive = active === item.href || active.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative inline-flex h-10 items-center rounded-sm px-3 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring tv:h-14 tv:px-4",
                        isActive ? "text-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-3 -bottom-px h-0.5 origin-left bg-accent transition-transform duration-(--ck-motion-duration-sm) ease-standard",
                          isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle enabled={themeToggleEnabled} />
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() => setInquiryOpen(true)}
            >
              Start a project
            </Button>

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-md"
                  className="lg:hidden"
                  aria-label="Open menu"
                >
                  <MenuIcon aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] max-w-[360px] bg-elevated">
                <SheetHeader className="pb-2">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <SheetDescription className="sr-only">Site navigation</SheetDescription>
                  <Wordmark className="h-5 text-fg" />
                </SheetHeader>
                <nav aria-label="Primary" className="px-4">
                  <ul className="flex flex-col">
                    {SITE_NAV.map((item, i) => {
                      const isActive = active === item.href || active.startsWith(`${item.href}/`);
                      return (
                        <li
                          key={item.href}
                          className="animate-in fade-in slide-in-from-right-2 fill-mode-both"
                          style={{
                            animationDelay: `calc(var(--ck-motion-stagger-sm) * ${String(i)})`,
                          }}
                        >
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setDrawerOpen(false)}
                            className={cn(
                              "flex h-12 items-center rounded-md px-3 text-body-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                              isActive
                                ? "bg-accent-soft text-accent-text"
                                : "text-fg hover:bg-accent-soft",
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
                  <ThemeToggle enabled={themeToggleEnabled} />
                  <Button asChild variant="secondary" size="lg" className="w-full">
                    <Link href="/auth/login" onClick={() => setDrawerOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      setDrawerOpen(false);
                      setInquiryOpen(true);
                    }}
                  >
                    Start a project
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <InquirySheet
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        serviceOptions={serviceOptions}
        source="inquiry_form"
      />
    </>
  );
}
