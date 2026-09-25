"use client";

import * as React from "react";
import { LockIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { CURRENCIES } from "@/lib/money";
import { Banner } from "../Banner";
import { Gauge } from "../charts/Gauge";
import { formatDateTime, plainNumber } from "../format";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { SettingsData } from "../types";

const SECTIONS = [
  ["general", "General / seller"],
  ["currencies", "Currencies & FX"],
  ["tax", "Tax & GSTIN"],
  ["payment-methods", "Payment methods"],
  ["theme", "Theme"],
  ["ai", "AI"],
  ["notifications", "Notifications"],
  ["flags", "Feature flags"],
  ["retention", "Retention"],
] as const;
type SectionKey = (typeof SECTIONS)[number][0];

export interface SettingsScreenProps {
  settings: SettingsData;
  isSuperAdmin: boolean;
  environment: "development" | "staging" | "production";
  initialSection?: SectionKey;
  chatbotHref: string;
  auditHref: string;
}

/** SCR-ADM-29 — settings with a nine-section rail, 760 px forms, per-section save bar and AlertDialogs for dangerous changes. */
export function SettingsScreen({
  settings: s,
  isSuperAdmin,
  environment,
  initialSection = "general",
  chatbotHref,
  auditHref,
}: SettingsScreenProps) {
  const [section, setSection] = React.useState<SectionKey>(initialSection);
  const [dangerous, setDangerous] = React.useState<string | null>(null);
  const [upi, setUpi] = React.useState(s.payments.upiEnabled);
  const [menuOnly, setMenuOnly] = React.useState(s.ai.menuOnly);
  const ro = !isSuperAdmin;
  const title = SECTIONS.find(([k]) => k === section)?.[1] ?? "";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform configuration that never needs a deploy. Every change is audited with before/after."
        actions={
          <Button asChild variant="link" size="sm">
            <a href={auditHref}>Audit trail</a>
          </Button>
        }
      />
      {ro ? (
        <Banner tone="warning" className="mb-4">
          Read-only — settings.write is limited to Super Admins.
        </Banner>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Settings sections"
          className="rounded-lg border border-border bg-surface p-2"
        >
          <ul className="space-y-0.5">
            {SECTIONS.map(([k, label]) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => setSection(k)}
                  aria-current={section === k ? "page" : undefined}
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-left text-body-sm hover:bg-accent-soft",
                    section === k && "bg-accent-soft font-medium text-accent-text",
                  )}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <form
          className="max-w-[760px] space-y-6 tv:max-w-[900px]"
          onSubmit={(e) => e.preventDefault()}
          key={section}
        >
          <h2 className="text-h3">{title}</h2>

          {section === "general" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: seller details appear on every invoice and email footer.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="st-site" label="Site name">
                  <Input id="st-site" readOnly value={s.general.siteName} />
                </Field>
                <Field id="st-domain" label="Domain">
                  <Input id="st-domain" defaultValue={s.general.domain} disabled={ro} />
                </Field>
                <Field id="st-legal" label="Legal name" required>
                  <Input id="st-legal" defaultValue={s.general.legalName} disabled={ro} />
                </Field>
                <Field
                  id="st-phones"
                  label="Contact phones"
                  hint="Invoice-only (D-406); never shown on the site."
                >
                  <Input id="st-phones" defaultValue={s.general.phones} disabled={ro} />
                </Field>
                <Field id="st-address" label="Address" required className="sm:col-span-2">
                  <Textarea
                    id="st-address"
                    rows={2}
                    defaultValue={s.general.address}
                    disabled={ro}
                  />
                </Field>
                <Field id="st-email" label="Email" hint="Invoice-only.">
                  <Input id="st-email" defaultValue={s.general.email} disabled={ro} />
                </Field>
                <Field id="st-reply" label="Support reply-time copy">
                  <Input id="st-reply" defaultValue={s.general.replyTime} disabled={ro} />
                </Field>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-body-sm font-semibold">
                  Query snippets (5 canned replies)
                </legend>
                {s.general.snippets.map((sn, i) => (
                  <div key={i}>
                    <Label htmlFor={`st-snip-${i}`} className="sr-only">
                      Snippet {i + 1}
                    </Label>
                    <Input id={`st-snip-${i}`} defaultValue={sn} disabled={ro} />
                  </div>
                ))}
              </fieldset>
              <p className="flex items-center gap-2 text-body-sm">
                Environment{" "}
                <Badge
                  tone={environment === "production" ? "danger" : "warning"}
                  dot
                  className="capitalize"
                >
                  {environment}
                </Badge>
              </p>
            </>
          ) : null}

          {section === "currencies" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: prices are stored per currency; INR is the reporting currency.
              </p>
              <Field
                id="st-base"
                label="Base currency"
                hint={
                  s.currencies.locked
                    ? "Read-only once the first paid order exists (base-currency lock)."
                    : `Changing is refused while ${s.currencies.pendingOrders} pending orders exist.`
                }
              >
                <div className="flex items-center gap-2">
                  <Select defaultValue={s.currencies.base} disabled={s.currencies.locked || ro}>
                    <SelectTrigger id="st-base" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {s.currencies.locked ? (
                    <span className="inline-flex items-center gap-1 text-caption text-fg-muted">
                      <LockIcon aria-hidden className="size-3.5" /> Locked
                    </span>
                  ) : null}
                </div>
              </Field>
              <fieldset className="space-y-2">
                <legend className="text-body-sm font-semibold">Enabled display currencies</legend>
                <div className="flex flex-wrap gap-4">
                  {CURRENCIES.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox
                        id={`cur-${c}`}
                        defaultChecked={s.currencies.enabled.includes(c)}
                        disabled={c === s.currencies.base || ro}
                      />
                      <Label htmlFor={`cur-${c}`}>{c}</Label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className="rounded-lg border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <h3 className="text-body-sm font-semibold">FX rates</h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={ro}
                    onClick={() => toast.success("Rates refreshed")}
                  >
                    <RefreshCwIcon aria-hidden /> Refresh rates now
                  </Button>
                </div>
                <Table>
                  <TableCaption className="sr-only">FX rates to INR</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote</TableHead>
                      <TableHead className="text-right">Rate (INR)</TableHead>
                      <TableHead>As of</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.currencies.fx.map((r) => (
                      <TableRow key={r.quote}>
                        <TableCell className="font-mono">{r.quote}</TableCell>
                        <TableCell className="text-right font-mono tnum">{r.rate}</TableCell>
                        <TableCell className={cn("text-fg-muted", r.stale && "text-warning")}>
                          {formatDateTime(r.asOf)}
                          {r.stale ? " · stale > 3 days" : ""}
                        </TableCell>
                        <TableCell className="text-fg-muted">{r.source}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Label htmlFor={`fx-ov-${r.quote}`} className="sr-only">
                              Override {r.quote}
                            </Label>
                            <Input
                              id={`fx-ov-${r.quote}`}
                              defaultValue={r.override ?? ""}
                              placeholder="—"
                              className="h-8 w-32 font-mono"
                              disabled={ro}
                            />
                            {r.override ? (
                              <Button variant="ghost" size="sm" disabled={ro}>
                                Clear
                              </Button>
                            ) : null}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {section === "tax" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: tax applies only to tax-enabled products and only once a GSTIN is
                set (BR-08).
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="st-gstin" label="GSTIN" hint="15 characters.">
                  <Input
                    id="st-gstin"
                    defaultValue={s.tax.gstin}
                    maxLength={15}
                    className="font-mono uppercase"
                    disabled={ro}
                  />
                </Field>
                <Field id="st-rate" label="Tax rate %">
                  <Input
                    id="st-rate"
                    inputMode="decimal"
                    defaultValue={(s.tax.rateBps / 100).toFixed(2)}
                    className="w-32 text-right font-mono"
                    disabled={ro}
                  />
                </Field>
                <Field id="st-state" label="Seller state" hint="Decides CGST/SGST vs IGST.">
                  <Input id="st-state" defaultValue={s.tax.sellerState} disabled={ro} />
                </Field>
              </div>
              <Banner tone="info">
                Invoice preview toggles between plain and GST breakdown once a GSTIN is set. Update
                the Terms after registration.
              </Banner>
            </>
          ) : null}

          {section === "payment-methods" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: these details are shown to customers at checkout and on the order
                page.
              </p>
              <section
                aria-labelledby="pm-upi"
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    id="st-upi"
                    checked={upi}
                    disabled={ro}
                    onCheckedChange={(v) => (v ? setUpi(true) : setDangerous("Disable UPI?"))}
                  />
                  <Label htmlFor="st-upi" id="pm-upi">
                    UPI enabled
                  </Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_160px]">
                  <Field id="st-vpa" label="VPA" required={upi}>
                    <Input
                      id="st-vpa"
                      defaultValue={s.payments.vpa}
                      className="font-mono"
                      disabled={ro}
                      placeholder="name@bank"
                    />
                  </Field>
                  <Field id="st-payee" label="Payee name">
                    <Input id="st-payee" defaultValue={s.payments.payeeName} disabled={ro} />
                  </Field>
                  <div className="space-y-1.5">
                    <span className="text-body-sm font-semibold">Sample QR</span>
                    <div
                      className="grid size-28 place-items-center rounded-md bg-inverse-fg text-caption text-inverse"
                      aria-label="Sample UPI QR preview on white"
                    >
                      QR
                    </div>
                  </div>
                </div>
              </section>
              <section
                aria-labelledby="pm-bank"
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <Switch id="st-bank" defaultChecked={s.payments.bankEnabled} disabled={ro} />
                  <Label htmlFor="st-bank" id="pm-bank">
                    Bank transfer enabled
                  </Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="st-acct-name" label="Account name" required>
                    <Input id="st-acct-name" defaultValue={s.payments.accountName} disabled={ro} />
                  </Field>
                  <Field id="st-acct-no" label="Account number" required>
                    <Input
                      id="st-acct-no"
                      defaultValue={s.payments.accountNumber}
                      className="font-mono"
                      disabled={ro}
                    />
                  </Field>
                  <Field id="st-ifsc" label="IFSC" required>
                    <Input
                      id="st-ifsc"
                      defaultValue={s.payments.ifsc}
                      className="font-mono uppercase"
                      disabled={ro}
                    />
                  </Field>
                  <Field id="st-bank-name" label="Bank name" required>
                    <Input id="st-bank-name" defaultValue={s.payments.bankName} disabled={ro} />
                  </Field>
                  <Field id="st-swift" label="SWIFT" optional>
                    <Input
                      id="st-swift"
                      defaultValue={s.payments.swift}
                      className="font-mono"
                      disabled={ro}
                    />
                  </Field>
                  <Field id="st-instr" label="Instructions note" className="sm:col-span-2">
                    <Textarea
                      id="st-instr"
                      rows={2}
                      defaultValue={s.payments.instructions}
                      disabled={ro}
                    />
                  </Field>
                </div>
              </section>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Razorpay", "Stripe", "PayPal"].map((g) => (
                  <div
                    key={g}
                    className="rounded-lg border border-dashed border-border p-4 opacity-70"
                  >
                    <p className="text-body-sm font-semibold">{g}</p>
                    <p className="text-caption text-fg-muted">
                      Enable in Feature flags after configuring keys (V1.1)
                    </p>
                  </div>
                ))}
              </div>
              <Banner tone="warning">
                Disabling a method used by active offerings affects:{" "}
                {s.payments.affectedOfferings.join(", ")}.
              </Banner>
            </>
          ) : null}

          {section === "theme" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: the default theme is what visitors see before they toggle.
              </p>
              <RadioGroup
                defaultValue={s.theme.defaultTheme}
                className="grid gap-3 sm:grid-cols-2"
                disabled={ro}
              >
                <RadioGroupCard value="dark-cinematic">
                  <span className="text-body font-semibold">Dark cinematic</span>
                  <span className="text-caption text-fg-muted">Default theme.</span>
                  <span aria-hidden className="mt-2 block h-16 rounded-sm bg-inverse" />
                </RadioGroupCard>
                <RadioGroupCard value="light-editorial" disabled={!s.theme.lightEnabled}>
                  <span className="text-body font-semibold">Light editorial</span>
                  <span className="text-caption text-fg-muted">
                    Enable the theme_light_editorial flag first.
                  </span>
                  <span
                    aria-hidden
                    className="mt-2 block h-16 rounded-sm border border-border bg-inverse-fg"
                  />
                </RadioGroupCard>
              </RadioGroup>
              <div className="flex items-center gap-3">
                <Switch id="st-toggle" checked disabled />
                <Label htmlFor="st-toggle">
                  Allow visitor toggle{" "}
                  <span className="text-caption font-normal text-fg-muted">(locked on, D-905)</span>
                </Label>
              </div>
            </>
          ) : null}

          {section === "ai" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: caps protect cost; menu-only mode is the emergency brake.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="st-model"
                  label="Model"
                  hint="Pricing note: input $3 / output $15 per M tokens (estimate)."
                >
                  <Select defaultValue={s.ai.model} disabled={ro}>
                    <SelectTrigger id="st-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet-4-5">claude-sonnet-4-5</SelectItem>
                      <SelectItem value="claude-haiku-4-5">claude-haiku-4-5</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="st-cap" label="Platform daily message cap" required>
                  <Input
                    id="st-cap"
                    inputMode="numeric"
                    defaultValue={s.ai.platformCap}
                    className="font-mono"
                    disabled={ro}
                    onBlur={(e) => {
                      if (e.target.value === "0") setDangerous("Lower the platform cap to 0?");
                    }}
                  />
                </Field>
                <Field id="st-user-cap" label="Per-user daily cap" required>
                  <Input
                    id="st-user-cap"
                    inputMode="numeric"
                    defaultValue={s.ai.perUserCap}
                    className="font-mono"
                    disabled={ro}
                  />
                </Field>
                <Field id="st-timeout" label="Timeout (s)">
                  <Input
                    id="st-timeout"
                    inputMode="numeric"
                    defaultValue={s.ai.timeoutS}
                    className="font-mono"
                    disabled={ro}
                  />
                </Field>
                <Field id="st-tokens" label="Max output tokens">
                  <Input
                    id="st-tokens"
                    inputMode="numeric"
                    defaultValue={s.ai.maxTokens}
                    className="font-mono"
                    disabled={ro}
                  />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="st-menu-only"
                  checked={menuOnly}
                  onCheckedChange={(v) =>
                    v ? setDangerous("Switch the assistant to menu-only mode?") : setMenuOnly(false)
                  }
                  disabled={ro}
                />
                <Label htmlFor="st-menu-only">Menu-only mode (emergency)</Label>
              </div>
              <Gauge
                value={s.ai.usedToday}
                max={s.ai.platformCap}
                label="Usage today"
                format={plainNumber}
              />
              <Button asChild variant="link" size="sm">
                <a href={chatbotHref}>Chatbot › Prompts</a>
              </Button>
            </>
          ) : null}

          {section === "notifications" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: customers get email + in-app; admins are in-app only (D-707).
              </p>
              <fieldset className="space-y-2">
                <legend className="text-body-sm font-semibold">Customer channels</legend>
                <div className="flex items-center gap-3">
                  <Switch id="nt-email" defaultChecked={s.notifications.email} disabled={ro} />
                  <Label htmlFor="nt-email">Email</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="nt-inapp" defaultChecked={s.notifications.inApp} disabled={ro} />
                  <Label htmlFor="nt-inapp">In-app</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="nt-wa" checked={s.notifications.whatsapp} disabled />
                  <Label htmlFor="nt-wa">
                    WhatsApp{" "}
                    <span className="text-caption font-normal text-fg-muted">
                      (flag-gated; per-message cost, D-1604)
                    </span>
                  </Label>
                </div>
              </fieldset>
              <p className="text-body-sm">
                <span className="font-semibold">Admin channel:</span> in-app only (read-only,
                D-707).
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 self-end">
                  <Switch
                    id="nt-digest"
                    defaultChecked={s.notifications.digestEnabled}
                    disabled={ro}
                  />
                  <Label htmlFor="nt-digest">Overdue follow-up digest email</Label>
                </div>
                <Field id="nt-digest-time" label="Send time">
                  <Input
                    id="nt-digest-time"
                    defaultValue={s.notifications.digestTime}
                    disabled={ro}
                  />
                </Field>
                <Field id="nt-sender" label="Resend sender" hint="Set by environment.">
                  <span className="flex gap-2">
                    <Input
                      id="nt-sender"
                      readOnly
                      value={s.notifications.sender}
                      className="font-mono"
                    />
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => toast.success("Test email sent")}
                    >
                      Send test email
                    </Button>
                  </span>
                </Field>
              </div>
            </>
          ) : null}

          {section === "flags" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: flags gate features that need extra configuration or belong to a
                later release.
              </p>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">Feature flags</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flag</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Dependency</TableHead>
                      <TableHead>Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.flags.map((f) => (
                      <TableRow key={f.key}>
                        <TableCell className="font-mono">
                          {f.key}
                          {f.envOverride ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-caption text-fg-muted">
                              <LockIcon aria-hidden className="size-3" /> Set by environment
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {f.description}
                          {f.placeholder ? (
                            <Badge tone="ghost" size="sm" className="ml-2">
                              V1.1 / V2
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-normal text-caption text-warning">
                          {f.dependency ?? ""}
                        </TableCell>
                        <TableCell>
                          <Switch
                            id={`flag-${f.key}`}
                            defaultChecked={f.enabled}
                            disabled={ro || f.envOverride || f.placeholder}
                            aria-label={`${f.key} enabled`}
                            aria-disabled={f.envOverride}
                            onCheckedChange={(v) => {
                              if (f.key === "three_hero" && !v)
                                setDangerous("Turn off the 3D hero?");
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {section === "retention" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: chat transcripts are purged after the retention window; records
                are kept for statutory periods.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="rt-chat" label="Chat transcripts (months)">
                  <Input
                    id="rt-chat"
                    inputMode="numeric"
                    defaultValue={s.retention.chatMonths}
                    className="w-32 font-mono"
                    disabled={ro}
                  />
                </Field>
                <Field id="rt-records" label="Records (years)" hint="Minimum 7 (read-only).">
                  <Input
                    id="rt-records"
                    readOnly
                    value={s.retention.recordYears}
                    className="w-32 font-mono"
                  />
                </Field>
              </div>
              <Banner tone="neutral">
                Personal data is anonymised immediately when a customer deletes the account (BR-18)
                — there is no delay setting.
              </Banner>
              <p className="text-body-sm text-fg-muted">
                Last run {formatDateTime(s.retention.lastRunAt)} · next purge{" "}
                {formatDateTime(s.retention.nextPurgeAt)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={ro}
                onClick={() => toast.success("Retention job queued")}
              >
                Run retention job now
              </Button>
            </>
          ) : null}

          <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-canvas px-4 py-3 lg:-mx-6 lg:px-6">
            <span className="text-caption text-fg-muted">
              Changes are audited with before/after.
            </span>
            <span className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" disabled={ro}>
                Discard
              </Button>
              <Button
                size="sm"
                disabled={ro}
                onClick={() =>
                  toast.success("Settings saved", { description: "View in audit log" })
                }
              >
                Save changes
              </Button>
            </span>
          </div>
        </form>
      </div>

      <Dialog open={dangerous !== null} onOpenChange={(o) => !o && setDangerous(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dangerous}</DialogTitle>
            <DialogDescription>
              {dangerous?.startsWith("Disable UPI")
                ? "Checkout will hide UPI; active offerings that only accept UPI cannot be bought until another method is enabled."
                : dangerous?.startsWith("Switch")
                  ? "The assistant will only offer quick-reply menus until you turn this off."
                  : dangerous?.startsWith("Lower")
                    ? "No AI answers will be served today."
                    : "Visitors will see the static poster instead of the 3D scene."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (dangerous?.startsWith("Disable UPI")) setUpi(false);
                if (dangerous?.startsWith("Switch")) setMenuOnly(true);
                setDangerous(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
