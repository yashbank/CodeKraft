"use client";

import Link from "next/link";
import * as React from "react";
import {
  BellIcon,
  BellOffIcon,
  BookOpenIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  FileTextIcon,
  InboxIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PackageIcon,
  PanelLeftIcon,
  PlusIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TagIcon,
  TargetIcon,
  TicketPercentIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/components/ui/_utils";
import { initials, timeAgo } from "./format";
import { LaptopNotice } from "./LaptopNotice";
import type { AdminNotification, AdminUserRef, SearchItem } from "./types";

/** Admin routes (docs/07 §2.4). `routes` can remap them (the previews point at /dev/screens). */
export type AdminRoute = string;

interface NavLeaf {
  label: string;
  route: AdminRoute;
  icon: LucideIcon;
  badge?: "approvals" | "notifications";
}
interface NavParent {
  label: string;
  icon: LucideIcon;
  base: string;
  children: Array<{ label: string; route: AdminRoute }>;
}
type NavItem = NavLeaf | NavParent;
interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar groups per docs/07 §3.4 / docs/08 §6.4. */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", route: "/dashboard", icon: LayoutDashboardIcon },
      { label: "Approvals", route: "/approvals", icon: ClipboardCheckIcon, badge: "approvals" },
      { label: "Notifications", route: "/notifications", icon: BellIcon, badge: "notifications" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", route: "/products", icon: PackageIcon },
      { label: "Categories", route: "/categories", icon: TagIcon },
      { label: "Coupons", route: "/coupons", icon: TicketPercentIcon },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Orders", route: "/orders", icon: ShoppingCartIcon },
      { label: "Quotes", route: "/quotes", icon: FileTextIcon },
      { label: "Customers", route: "/customers", icon: UsersIcon },
      { label: "Entitlements", route: "/entitlements", icon: KeyRoundIcon },
      { label: "Delivery tasks", route: "/delivery-tasks", icon: TruckIcon },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Leads", route: "/leads", icon: TargetIcon },
      { label: "Queries", route: "/queries", icon: MessageSquareIcon },
      { label: "Chatbot", route: "/chatbot", icon: BotIcon },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Finance",
        icon: CoinsIcon,
        base: "/finance",
        children: [
          { label: "Ledger", route: "/finance/ledger" },
          { label: "Allocations", route: "/finance/allocations" },
          { label: "Partners & payouts", route: "/finance/partners" },
          { label: "Expenses", route: "/finance/expenses" },
          { label: "Adjustments", route: "/finance/adjustments" },
          { label: "Reports & statements", route: "/finance/reports" },
        ],
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        label: "Content",
        icon: BookOpenIcon,
        base: "/content",
        children: [
          { label: "Landing", route: "/content/landing" },
          { label: "Services", route: "/content/services" },
          { label: "Case studies", route: "/content/case-studies" },
          { label: "Testimonials & logos", route: "/content/testimonials" },
          { label: "FAQs", route: "/content/faqs" },
          { label: "Legal", route: "/content/legal" },
        ],
      },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", route: "/settings", icon: SettingsIcon },
      { label: "Audit log", route: "/audit", icon: ScrollTextIcon },
      { label: "Admin users", route: "/admin-users", icon: UserCogIcon },
    ],
  },
];

/** The three destinations reachable below `lg` (docs/07 §3.4). */
const READ_MOSTLY_NAV: Array<{ label: string; route: AdminRoute; icon: LucideIcon }> = [
  { label: "Approvals", route: "/approvals", icon: ClipboardCheckIcon },
  { label: "Orders · payment confirmation", route: "/orders", icon: ShoppingCartIcon },
  { label: "Notifications", route: "/notifications", icon: BellIcon },
];

const CREATE_ITEMS: Array<{ label: string; route: AdminRoute }> = [
  { label: "Product", route: "/products/new" },
  { label: "Manual order", route: "/orders/new" },
  { label: "Quote", route: "/quotes" },
  { label: "Lead", route: "/leads" },
  { label: "Expense", route: "/finance/expenses" },
];

export interface AdminShellProps {
  /** Route key of the current screen (e.g. "/orders"); drives the active sidebar item. */
  active: AdminRoute;
  user: AdminUserRef;
  environment: "development" | "staging" | "production";
  pendingApprovals: number;
  notifications: AdminNotification[];
  /** ISO timestamp used for relative times (deterministic SSR). */
  now: string;
  /** Screen title for the phone top bar and the "Open on a laptop" notice. */
  title: string;
  /** One-line read-only summary shown in the notice where cheap (counts). */
  summary?: string;
  /** Approvals, payment confirmation and notifications render below `lg`; everything else shows the notice. */
  readMostly?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  searchItems?: SearchItem[];
  /** Remap admin routes to other hrefs (previews). Unmapped routes are used as-is. */
  routes?: Record<string, string>;
  /** CSS length the sticky sidebar must clear (the dev preview header). */
  stickyTop?: string;
  children: React.ReactNode;
}

/**
 * Admin shell — docs/07 §3.4, docs/08 §6.4. Sidebar (256 px, collapsible to a 64 px icon rail),
 * 56 px top bar with breadcrumb, ⌘K search, "Create" menu, environment badge, notification bell
 * popover and avatar menu. Below `lg` the sidebar becomes a Sheet with the three supported
 * destinations, and non-read-mostly screens render the "Open on a laptop" notice.
 */
export function AdminShell({
  active,
  user,
  environment,
  pendingApprovals,
  notifications,
  now,
  title,
  summary,
  readMostly = false,
  breadcrumbs,
  searchItems = [],
  routes,
  stickyTop = "0px",
  children,
}: AdminShellProps) {
  const href = React.useCallback((route: AdminRoute) => routes?.[route] ?? route, [routes]);
  const [open, setOpen] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const unread = notifications.filter((n) => !n.read && !readIds.has(n.id)).length;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (route: AdminRoute) => active === route || active.startsWith(`${route}/`);
  const envTone =
    environment === "production" ? "danger" : environment === "staging" ? "warning" : "neutral";

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      style={{ "--admin-top": stickyTop } as React.CSSProperties}
      className="bg-canvas text-fg"
      data-app="admin"
    >
      <aside
        aria-label="Admin navigation"
        data-state={open ? "expanded" : "collapsed"}
        data-collapsible={open ? "" : "icon"}
        className={cn(
          "group sticky top-(--admin-top) hidden h-[calc(100svh-var(--admin-top))] w-(--sidebar-width) shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-(--ck-motion-duration-md) ease-standard lg:flex",
          "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          !open && "w-(--sidebar-width-icon)",
        )}
      >
        <SidebarHeader className="h-14 flex-row items-center justify-between border-b border-border px-3">
          <Link
            href={href("/dashboard")}
            className="flex items-center gap-2 font-display text-body font-semibold"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-sm bg-accent font-mono text-caption text-accent-fg"
            >
              CK
            </span>
            <span className="group-data-[collapsible=icon]:hidden">
              CodeKraft <span className="text-fg-muted">Admin</span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="py-2">
          {ADMIN_NAV.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="text-overline tracking-wider uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) =>
                    "children" in item ? (
                      <NavParentItem key={item.label} item={item} active={active} href={href} />
                    ) : (
                      <SidebarMenuItem key={item.route}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.route)}
                          tooltip={item.label}
                        >
                          <Link
                            href={href(item.route)}
                            aria-current={isActive(item.route) ? "page" : undefined}
                          >
                            <item.icon aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.badge === "approvals" && pendingApprovals > 0 ? (
                          <SidebarMenuBadge className="rounded-full bg-danger px-1.5 text-danger-fg">
                            {pendingApprovals}
                            <span className="sr-only"> pending approvals</span>
                          </SidebarMenuBadge>
                        ) : null}
                        {item.badge === "notifications" && unread > 0 ? (
                          <SidebarMenuBadge className="rounded-full bg-accent-soft px-1.5 text-accent-text">
                            {unread}
                            <span className="sr-only"> unread notifications</span>
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    ),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => setOpen((v) => !v)}
            aria-pressed={!open}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            <PanelLeftIcon aria-hidden />
            <span className="group-data-[collapsible=icon]:hidden">Collapse</span>
          </Button>
        </SidebarFooter>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-(--admin-top) z-(--ck-z-header) flex h-14 items-center gap-2 border-b border-border bg-canvas px-3 lg:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <Breadcrumb className="hidden lg:block">
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, i) => {
                    const last = i === breadcrumbs.length - 1;
                    return (
                      <React.Fragment key={`${crumb.label}-${i}`}>
                        <BreadcrumbItem>
                          {last || !crumb.href ? (
                            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link href={crumb.href}>{crumb.label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {last ? null : <BreadcrumbSeparator />}
                      </React.Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
            <span className="truncate text-body font-semibold lg:hidden">{title}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hidden w-64 justify-start gap-2 text-fg-muted md:inline-flex"
            onClick={() => setPaletteOpen(true)}
            aria-keyshortcuts="Meta+K Control+K"
          >
            <SearchIcon aria-hidden />
            <span className="flex-1 text-left">Search products, orders, customers…</span>
            <kbd className="rounded-xs border border-border px-1.5 font-mono text-caption text-fg-subtle">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Search"
            onClick={() => setPaletteOpen(true)}
          >
            <SearchIcon aria-hidden />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="hidden lg:inline-flex">
                <PlusIcon aria-hidden /> Create <ChevronDownIcon aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CREATE_ITEMS.map((c) => (
                <DropdownMenuItem key={c.label} asChild>
                  <Link href={href(c.route)}>{c.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge tone={envTone} className="hidden capitalize sm:inline-flex" dot>
            {environment}
          </Badge>
          <NotificationBell
            notifications={notifications}
            readIds={readIds}
            now={now}
            unread={unread}
            onMarkAll={() => setReadIds(new Set(notifications.map((n) => n.id)))}
            onRead={(id) => setReadIds((s) => new Set([...s, id]))}
            viewAllHref={href("/notifications")}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`Account menu for ${user.name}`}
              >
                <Avatar>
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{user.name}</span>
                <span className="text-caption font-normal text-fg-muted">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={href("/admin-users")}>Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={href("/admin-users")}>
                  <KeyRoundIcon aria-hidden /> Security (TOTP)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={href("/login")}>
                  <LogOutIcon aria-hidden /> Sign out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="admin-main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">
          {readMostly ? (
            children
          ) : (
            <>
              <div className="lg:hidden">
                <LaptopNotice
                  title={title}
                  summary={summary}
                  approvalsHref={href("/approvals")}
                  notificationsHref={href("/notifications")}
                />
              </div>
              <div className="hidden lg:block">{children}</div>
            </>
          )}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="lg:w-80">
          <SheetHeader>
            <SheetTitle>CodeKraft Admin</SheetTitle>
            <SheetDescription>
              On a phone or tablet only approvals, payment confirmation and notifications are
              available.
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Read-mostly destinations" className="flex flex-col gap-1 px-4">
            {READ_MOSTLY_NAV.map((item) => (
              <Link
                key={item.route}
                href={href(item.route)}
                aria-current={isActive(item.route) ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-body hover:bg-accent-soft",
                  isActive(item.route) && "bg-accent-soft text-accent-text",
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon aria-hidden className="size-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Search"
        description="Products, orders by number, customers by email, leads by name"
      >
        <CommandInput placeholder="Search products, orders, customers, leads…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {(["Products", "Orders", "Customers", "Leads", "Go to"] as const).map((group) => {
            const items = searchItems.filter((s) => s.group === group);
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((s) => (
                  <CommandItem
                    key={`${group}-${s.label}`}
                    asChild
                    value={`${group} ${s.label} ${s.hint ?? ""}`}
                  >
                    <Link href={s.href} onClick={() => setPaletteOpen(false)}>
                      <span>{s.label}</span>
                      {s.hint ? (
                        <span className="ml-auto text-caption text-fg-muted">{s.hint}</span>
                      ) : null}
                    </Link>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
      <Toaster />
    </SidebarProvider>
  );
}

function NavParentItem({
  item,
  active,
  href,
}: {
  item: NavParent;
  active: AdminRoute;
  href: (route: AdminRoute) => string;
}) {
  const within = active.startsWith(item.base);
  const [expanded, setExpanded] = React.useState(within);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={within}
        tooltip={item.label}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <item.icon aria-hidden />
        <span>{item.label}</span>
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "ml-auto transition-transform group-data-[collapsible=icon]:hidden",
            expanded && "rotate-90",
          )}
        />
      </SidebarMenuButton>
      {expanded ? (
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.route}>
              <SidebarMenuSubButton asChild isActive={active === child.route}>
                <Link
                  href={href(child.route)}
                  aria-current={active === child.route ? "page" : undefined}
                >
                  <span>{child.label}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

const TYPE_ICON: Record<AdminNotification["type"], LucideIcon> = {
  payments: CoinsIcon,
  leads: TargetIcon,
  queries: MessageSquareIcon,
  approvals: ClipboardCheckIcon,
  delivery: TruckIcon,
  chatbot: BotIcon,
  system: SettingsIcon,
};

/** Bell + inbox popover — docs/08 §6.14: 8 latest, All/Unread tabs, "Mark all read", "View all". */
function NotificationBell({
  notifications,
  readIds,
  now,
  unread,
  onMarkAll,
  onRead,
  viewAllHref,
}: {
  notifications: AdminNotification[];
  readIds: ReadonlySet<string>;
  now: string;
  unread: number;
  onMarkAll: () => void;
  onRead: (id: string) => void;
  viewAllHref: string;
}) {
  const isRead = (n: AdminNotification) => n.read || readIds.has(n.id);
  const latest = notifications.slice(0, 8);
  const list = (items: AdminNotification[]) =>
    items.length === 0 ? (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-body-sm text-fg-muted">
        <BellOffIcon aria-hidden className="size-8 text-fg-subtle" />
        You&rsquo;re up to date
      </div>
    ) : (
      <ul className="divide-y divide-border">
        {items.map((n) => {
          const Icon = TYPE_ICON[n.type];
          return (
            <li key={n.id}>
              <Link
                href={n.href ?? viewAllHref}
                onClick={() => onRead(n.id)}
                className="flex min-h-16 items-start gap-3 px-3 py-2 hover:bg-accent-soft/60"
              >
                <span className="relative mt-1">
                  <Icon aria-hidden className="size-4 text-fg-muted" />
                  {!isRead(n) ? (
                    <span
                      aria-hidden
                      className="absolute -top-1 -right-1 size-2 rounded-full bg-accent"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn("block truncate text-body-sm", !isRead(n) && "font-semibold")}
                  >
                    {!isRead(n) ? <span className="sr-only">Unread: </span> : null}
                    {n.title}
                  </span>
                  <span className="block truncate text-caption text-fg-muted">{n.body}</span>
                </span>
                <time dateTime={n.at} className="shrink-0 text-caption text-fg-subtle">
                  {timeAgo(n.at, now)}
                </time>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-md"
          className="relative"
          aria-label={`Notifications, ${unread} unread`}
        >
          <BellIcon aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] leading-none font-semibold text-danger-fg"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(400px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-body-sm font-semibold">Notifications</span>
          <Button variant="link" size="sm" onClick={onMarkAll} disabled={unread === 0}>
            Mark all read
          </Button>
        </div>
        <Tabs defaultValue="all">
          <TabsList variant="line" className="w-full px-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unread})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="max-h-[420px] overflow-auto">
            {list(latest)}
          </TabsContent>
          <TabsContent value="unread" className="max-h-[420px] overflow-auto">
            {list(latest.filter((n) => !isRead(n)))}
          </TabsContent>
        </Tabs>
        <div className="border-t border-border px-3 py-2 text-right">
          <Button asChild variant="link" size="sm">
            <Link href={viewAllHref}>
              <InboxIcon aria-hidden /> View all
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
