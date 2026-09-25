"use client";

import {
  ArrowLeftIcon,
  BellIcon,
  BotIcon,
  ChevronRightIcon,
  HeartIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PackageIcon,
  ReceiptTextIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/components/ui/_utils";
import type { Currency } from "@/lib/money";
import { CurrencySelect } from "./CurrencySelect";
import { NotificationBell } from "./NotificationBell";
import type { NotificationItem } from "./types";
import { Wordmark } from "./Wordmark";

export type AccountNavKey =
  | "overview"
  | "purchases"
  | "invoices"
  | "queries"
  | "chat"
  | "wishlist"
  | "notifications"
  | "settings";

export const ACCOUNT_NAV: { key: AccountNavKey; label: string; href: string; Icon: LucideIcon }[] =
  [
    { key: "overview", label: "Overview", href: "/account", Icon: HomeIcon },
    {
      key: "purchases",
      label: "Purchases & access",
      href: "/account/purchases",
      Icon: PackageIcon,
    },
    {
      key: "invoices",
      label: "Invoices & payments",
      href: "/account/invoices",
      Icon: ReceiptTextIcon,
    },
    { key: "queries", label: "Queries", href: "/account/queries", Icon: MessageSquareIcon },
    { key: "chat", label: "Chat", href: "/account/chat", Icon: BotIcon },
    { key: "wishlist", label: "Wishlist", href: "/account/wishlist", Icon: HeartIcon },
    {
      key: "notifications",
      label: "Notifications",
      href: "/account/notifications",
      Icon: BellIcon,
    },
    { key: "settings", label: "Settings", href: "/account/settings", Icon: SettingsIcon },
  ];

const TAB_BAR: AccountNavKey[] = ["overview", "purchases", "queries", "chat"];

export interface AccountShellProps {
  user: { name: string; email: string; initials: string };
  active?: AccountNavKey;
  /** Section title for the phone top bar and the desktop breadcrumb root. */
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
  currency: Currency;
  onCurrencyChange?: (c: Currency) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  now: string;
  /** Checkout / quote: sidebar and tab bar hidden, "Back to …" link in the top bar. */
  minimal?: { backHref: string; backLabel: string };
  /** Override nav hrefs (previews point at /dev/screens routes). */
  links?: Partial<Record<AccountNavKey, string>>;
  children: React.ReactNode;
}

/**
 * Account shell — docs/07 §3.3 / docs/08 §6.4: 240px sidebar at `lg+` (active item accent-soft +
 * 3px accent rule), top bar with breadcrumb, currency selector, bell and avatar menu; phone gets a
 * drawer (menu button) and a bottom tab bar (Overview · Purchases · Queries · Chat · More).
 */
export function AccountShell({
  user,
  active,
  title,
  breadcrumb,
  currency,
  onCurrencyChange,
  notifications,
  unreadCount,
  now,
  minimal,
  links,
  children,
}: AccountShellProps) {
  const [drawer, setDrawer] = React.useState(false);
  const nav = ACCOUNT_NAV.map((n) => ({ ...n, href: links?.[n.key] ?? n.href }));
  const activeItem = nav.find((n) => n.key === active);
  const heading = title ?? activeItem?.label ?? "Account";

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ul className="space-y-0.5">
      {nav.map((n) => {
        const isActive = n.key === active;
        return (
          <li key={n.key}>
            <Link
              href={n.href}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md border-l-[3px] border-transparent px-3 text-body-sm font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isActive && "border-accent bg-accent-soft text-accent-text",
              )}
            >
              <n.Icon aria-hidden className="size-[18px]" />
              <span className="flex-1">{n.label}</span>
              {n.key === "notifications" && unreadCount > 0 ? (
                <span className="rounded-full bg-danger px-1.5 font-mono text-[10px] font-semibold text-danger-fg">
                  {unreadCount > 99 ? "99+" : unreadCount}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] bg-canvas text-fg">
      {!minimal ? (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <div className="px-5 py-5">
            <Wordmark />
          </div>
          <nav aria-label="Account" className="flex-1 px-3">
            <NavList />
          </nav>
          <div className="border-t border-border p-3">
            <Link
              href="/"
              className="flex h-10 items-center gap-3 rounded-md px-3 text-body-sm text-fg-muted hover:bg-accent-soft hover:text-fg"
            >
              <ArrowLeftIcon aria-hidden className="size-[18px]" /> Back to site
            </Link>
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-4 lg:h-16 lg:px-8">
          {minimal ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={minimal.backHref}>
                  <ArrowLeftIcon aria-hidden /> {minimal.backLabel}
                </Link>
              </Button>
              <Wordmark className="ml-2 hidden sm:inline-flex" />
            </>
          ) : (
            <>
              <Sheet open={drawer} onOpenChange={setDrawer}>
                <Button
                  variant="ghost"
                  size="icon-md"
                  className="lg:hidden"
                  aria-label="Open account menu"
                  onClick={() => setDrawer(true)}
                >
                  <MenuIcon aria-hidden />
                </Button>
                <SheetContent side="left" className="z-(--ck-z-modal) w-[88vw] max-w-[360px]">
                  <SheetHeader>
                    <SheetTitle>
                      <Wordmark />
                    </SheetTitle>
                    <SheetDescription className="sr-only">Account sections</SheetDescription>
                  </SheetHeader>
                  <nav aria-label="Account" className="px-2">
                    <NavList onNavigate={() => setDrawer(false)} />
                  </nav>
                  <div className="mt-auto border-t border-border p-4">
                    <Link href="/" className="flex items-center gap-2 text-body-sm text-fg-muted">
                      <ArrowLeftIcon aria-hidden className="size-4" /> Back to site
                    </Link>
                  </div>
                </SheetContent>
              </Sheet>
              <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                <ol className="flex items-center gap-1 text-body-sm text-fg-muted">
                  <li className="hidden lg:block">
                    <Link href={links?.overview ?? "/account"} className="hover:text-fg">
                      Account
                    </Link>
                  </li>
                  {breadcrumb?.length ? (
                    breadcrumb.map((b, i) => {
                      const last = i === breadcrumb.length - 1;
                      return (
                        <li key={`${b.label}-${i}`} className="flex min-w-0 items-center gap-1">
                          <ChevronRightIcon aria-hidden className="hidden size-3.5 lg:block" />
                          {last || !b.href ? (
                            <span
                              aria-current={last ? "page" : undefined}
                              className="truncate font-medium text-fg"
                            >
                              {b.label}
                            </span>
                          ) : (
                            <Link href={b.href} className="hidden truncate hover:text-fg lg:block">
                              {b.label}
                            </Link>
                          )}
                        </li>
                      );
                    })
                  ) : (
                    <li className="flex min-w-0 items-center gap-1">
                      <ChevronRightIcon aria-hidden className="hidden size-3.5 lg:block" />
                      <span aria-current="page" className="truncate font-medium text-fg">
                        {heading}
                      </span>
                    </li>
                  )}
                </ol>
              </nav>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <CurrencySelect
              value={currency}
              onChange={onCurrencyChange}
              className="hidden sm:flex"
            />
            <NotificationBell
              items={notifications}
              unreadCount={unreadCount}
              now={now}
              viewAllHref={links?.notifications ?? "/account/notifications"}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Account menu for ${user.name}`}
                  className="ml-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Avatar>
                    <AvatarFallback>{user.initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block truncate text-body-sm font-semibold text-fg">
                    {user.name}
                  </span>
                  <span className="block truncate text-caption font-normal text-fg-muted">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={links?.overview ?? "/account"}>Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={links?.purchases ?? "/account/purchases"}>Purchases</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={links?.queries ?? "/account/queries"}>Queries</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={links?.settings ?? "/account/settings"}>Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">Back to site</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LogOutIcon aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 lg:px-8 lg:py-8",
            !minimal && "pb-24 lg:pb-8",
          )}
        >
          {children}
        </main>

        {!minimal ? (
          <nav
            aria-label="Account sections"
            className="fixed inset-x-0 bottom-0 z-(--ck-z-sticky) border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          >
            <ul className="grid grid-cols-5">
              {TAB_BAR.map((key) => {
                const n = nav.find((x) => x.key === key);
                if (!n) return null;
                const isActive = key === active;
                return (
                  <li key={key}>
                    <Link
                      href={n.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-fg-muted",
                        isActive && "text-accent-text",
                      )}
                    >
                      <n.Icon aria-hidden className="size-5" />
                      {n.label.split(" ")[0]}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setDrawer(true)}
                  className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-fg-muted"
                >
                  <MenuIcon aria-hidden className="size-5" />
                  More
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
