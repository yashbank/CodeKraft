"use client";

import * as React from "react";
import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { cn } from "@/components/ui/_utils";
import { CHAT_MODELS, chatModelOptionLabel } from "@/modules/chat/models";
import { CURRENCIES } from "@/lib/money";
import { PALETTES } from "@/lib/palettes";
import { uploadMediaFile } from "@/lib/admin/media-upload";
import { updateRazorpaySettings, updateSettings } from "@/modules/settings/admin-mutations";
import { testRazorpayConnection } from "@/modules/settings/razorpay-test-connection";
import { Banner } from "../Banner";
import { DangerZoneSection } from "./DangerZoneSection";
import { ManualPaymentSettings } from "./ManualPaymentSettings";
import { PageHeader } from "../PageHeader";
import { Field } from "../RichTextField";
import type { SiteSettings } from "@/modules/settings/types";
import type { SettingsData } from "../types";

/**
 * Site logo: upload / replace / remove. Saves immediately (like the feature flags) through the
 * same `settings.write`-gated `updateSettings` action; `ro` hides the controls for other roles.
 */
function SiteLogoField({ logo, ro }: { logo: string | null; ro: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function save(next: string | null, ok: string) {
    const res = await updateSettings({ patch: { siteLogo: next } });
    if (!res.ok) throw new Error(res.error.message);
    toast.success(ok);
    router.refresh();
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadMediaFile(file, "site_logo");
      if (!up.url) throw new Error("Upload finished without a public URL");
      await save(up.url, "Logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function onRemove() {
    setBusy(true);
    try {
      await save(null, "Logo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="st-logo">Site logo</Label>
      <div className="flex flex-wrap items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded URL
          <img
            src={logo}
            alt="Current site logo"
            className="h-10 w-auto rounded-sm border border-border bg-surface p-1"
          />
        ) : (
          <span className="text-body-sm text-fg-muted">
            No logo set: the site name is shown as text.
          </span>
        )}
        {!ro ? (
          <>
            <Input
              id="st-logo"
              type="file"
              accept="image/png,image/jpeg"
              onChange={onFile}
              disabled={busy}
              className="max-w-64"
            />
            {logo ? (
              <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={busy}>
                Remove
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <p className="text-body-sm text-fg-muted">
        PNG or JPEG, up to 2 MB. Used in the header, footer, admin, emails, invoices and browser tab
        icon.
      </p>
    </div>
  );
}

/**
 * Razorpay config card (V1.1, D-501, TEST MODE ONLY) inside the "Payment methods" section. Unlike
 * the rest of this screen (every other section's "Save changes" is still a `toast`-only mock, see
 * `lib/admin/settings-view.ts`'s doc comment), this card is fully wired: `updateRazorpaySettings`
 * (`modules/settings/admin-mutations.ts`) is a real Server Action, gated by the same
 * `settings.write` permission as every other settings write and CSRF-protected by Next's
 * built-in Server Action origin check. The enable switch patches the real `provider_razorpay`
 * feature flag through that same action — no separate flag-toggle mechanism.
 */
function RazorpaySection({
  razorpay,
  ro,
}: {
  razorpay: SettingsData["payments"]["razorpay"];
  ro: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(razorpay.enabled);
  const [mode, setMode] = React.useState<"test" | "live">(razorpay.mode);
  const [keyId, setKeyId] = React.useState(razorpay.keyId);
  // Only ever a NEW value the admin typed — never the masked placeholder. Empty means "keep the
  // currently persisted secret", resolved server-side in `updateRazorpaySettings`.
  const [keySecret, setKeySecret] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setTestResult(null);
    const res = await updateRazorpaySettings({
      mode,
      keyId: keyId.trim() || null,
      ...(keySecret.trim() ? { keySecret: keySecret.trim() } : {}),
      ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      enabled,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Razorpay settings saved", { description: "View in audit log" });
    setKeySecret("");
    setWebhookSecret("");
    router.refresh();
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await testRazorpayConnection();
    setTesting(false);
    if (res.ok) {
      setTestResult({ ok: true, message: "Connected — Razorpay accepted a test order." });
      toast.success("Razorpay connection OK");
    } else {
      setTestResult({ ok: false, message: res.error.message });
      toast.error(res.error.message);
    }
  }

  return (
    <section
      aria-labelledby="pm-razorpay"
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch
            id="st-razorpay"
            checked={enabled}
            disabled={ro}
            onCheckedChange={(v) => setEnabled(v)}
          />
          <Label htmlFor="st-razorpay" id="pm-razorpay">
            Razorpay enabled{" "}
            <span className="text-caption font-normal text-fg-muted">(test mode only)</span>
          </Label>
        </div>
        <Badge tone={enabled ? "success" : "ghost"} dot>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rzp-key-id" label="Key ID">
          <Input
            id="rzp-key-id"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            className="font-mono"
            disabled={ro}
            placeholder="rzp_test_…"
          />
        </Field>
        <Field id="rzp-mode" label="Mode">
          <Select value={mode} onValueChange={(v) => setMode(v as "test" | "live")} disabled={ro}>
            <SelectTrigger id="rzp-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="rzp-key-secret"
          label="Key secret"
          hint={
            razorpay.keySecretMasked
              ? `Currently set (ends ${razorpay.keySecretMasked.slice(-4)}). Leave blank to keep it.`
              : "Not set yet."
          }
        >
          <Input
            id="rzp-key-secret"
            type="password"
            autoComplete="off"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            placeholder={razorpay.keySecretMasked || "Not set"}
            disabled={ro}
          />
        </Field>
        <Field
          id="rzp-webhook-secret"
          label="Webhook secret"
          hint={
            razorpay.webhookSecretMasked
              ? `Currently set (ends ${razorpay.webhookSecretMasked.slice(-4)}). Leave blank to keep it.`
              : "Not set yet."
          }
        >
          <Input
            id="rzp-webhook-secret"
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={razorpay.webhookSecretMasked || "Not set"}
            disabled={ro}
          />
        </Field>
      </div>
      <Field
        id="rzp-webhook-url"
        label="Webhook URL"
        hint="Paste this into the Razorpay dashboard's webhook settings."
      >
        <div className="flex gap-2">
          <Input id="rzp-webhook-url" readOnly value={razorpay.webhookUrl} className="font-mono" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard
                .writeText(razorpay.webhookUrl)
                .then(() => toast.success("Copied", { description: "Webhook URL" }))
                .catch(() => toast.error("Couldn't copy — select the text and copy it manually."));
            }}
          >
            Copy
          </Button>
        </div>
      </Field>
      {testResult ? (
        <Banner tone={testResult.ok ? "success" : "danger"}>{testResult.message}</Banner>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={testing}
          disabled={ro}
          onClick={() => void handleTestConnection()}
        >
          Test connection
        </Button>
        <Button
          type="button"
          size="sm"
          loading={saving}
          disabled={ro}
          onClick={() => void handleSave()}
        >
          Save Razorpay settings
        </Button>
      </div>
    </section>
  );
}

/**
 * Sections whose fields map onto `site_settings` keys and share the bottom save bar. Feature
 * flags save per toggle; Notifications is read-only information.
 */
const SAVEABLE_SECTIONS: readonly string[] = [
  "general",
  "currencies",
  "tax",
  "ai",
  "retention",
  "theme",
];

/** Flags for integrations that have no provider in this build — hidden instead of teased. */
const HIDDEN_FLAGS: ReadonlySet<string> = new Set([
  "provider_stripe",
  "provider_paypal",
  "vendor_marketplace",
  "bundles",
  "automated_provisioning",
]);

const SECTIONS = [
  ["general", "General / seller"],
  ["currencies", "Currencies"],
  ["tax", "Tax & GSTIN"],
  ["payment-methods", "Payment methods"],
  ["theme", "Theme"],
  ["ai", "AI"],
  ["notifications", "Notifications"],
  ["flags", "Feature flags"],
  ["retention", "Retention"],
  ["danger", "Danger zone"],
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

/** Maps zod dotted paths from `updateSettings` onto the General-section input ids. */
function mapSettingsFieldErrors(fe: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fe) return out;
  const idFor = (path: string): string | undefined => {
    if (path === "patch.siteName") return "st-site";
    if (path === "patch.baseCurrency") return "st-base";
    if (path === "patch.enabledCurrencies") return "st-currencies";
    if (path === "patch.upiVpa" || path === "upiVpa") return "st-vpa";
    if (path === "patch.taxRateBps") return "st-rate";
    if (path === "patch.gstin") return "st-gstin";
    if (path === "patch.aiDailyPlatformCap") return "st-cap";
    if (path === "patch.aiDailyUserCap") return "st-user-cap";
    if (path === "patch.chatTimeoutMs") return "st-timeout";
    if (path.startsWith("patch.retention")) return "rt-chat";
    const b = /^patch\.bankDetails\.(\w+)$/.exec(path)?.[1];
    if (b) {
      return (
        {
          accountName: "st-acct-name",
          accountNumber: "st-acct-no",
          ifsc: "st-ifsc",
          bankName: "st-bank-name",
        } as Record<string, string>
      )[b];
    }
    if (path === "patch.sellerDetails.name") return "st-legal";
    if (path === "patch.sellerDetails.email") return "st-email";
    if (path.startsWith("patch.sellerDetails.contactPhones")) return "st-phones";
    const a = /^patch\.sellerDetails\.address\.(\w+)$/.exec(path)?.[1];
    return a
      ? (
          {
            line1: "st-addr1",
            line2: "st-addr2",
            city: "st-city",
            state: "st-addr-state",
            postalCode: "st-postal",
            country: "st-country",
          } as Record<string, string>
        )[a]
      : undefined;
  };
  for (const [path, msgs] of Object.entries(fe)) {
    const id = idFor(path);
    if (id && msgs[0] && !out[id]) out[id] = msgs[0];
  }
  return out;
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
  const [baseCurrency, setBaseCurrency] = React.useState(s.currencies.base);
  const [enabledCurrencies, setEnabledCurrencies] = React.useState(s.currencies.enabled);
  const [flagValues, setFlagValues] = React.useState<Record<string, boolean>>({});
  const [savingFlag, setSavingFlag] = React.useState<string | null>(null);
  const [formVersion, setFormVersion] = React.useState(0);
  const ro = !isSuperAdmin;
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [theme, setTheme] = React.useState(s.theme.defaultTheme);
  const [themeToggle, setThemeToggle] = React.useState(s.theme.toggle);
  const [palette, setPalette] = React.useState(s.theme.palette);
  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const saveable = SAVEABLE_SECTIONS.includes(section);
  const title = SECTIONS.find(([k]) => k === section)?.[1] ?? "";

  /** "Discard" — controlled inputs go back to the saved values (uncontrolled ones remount). */
  function resetSectionState() {
    setBaseCurrency(s.currencies.base);
    setEnabledCurrencies(s.currencies.enabled);
    setTheme(s.theme.defaultTheme);
    setThemeToggle(s.theme.toggle);
    setPalette(s.theme.palette);
  }

  async function saveFlag(key: string, value: boolean) {
    setSavingFlag(key);
    setFlagValues((prev) => ({ ...prev, [key]: value }));
    try {
      const res = await updateSettings({ patch: { flags: { [key]: value } } });
      if (!res.ok) {
        setFlagValues((prev) => ({ ...prev, [key]: !value }));
        toast.error(res.error.message);
        return;
      }
      toast.success(`${key} ${value ? "enabled" : "disabled"}`, {
        description: "View in audit log",
      });
      router.refresh();
    } finally {
      setSavingFlag(null);
    }
  }

  async function handleSave() {
    const val = (id: string) =>
      (formRef.current?.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "").trim();
    let patch: Record<string, unknown>;
    if (section === "general") {
      const siteName = val("st-site");
      const seller = s.tax.seller;
      const legal = val("st-legal");
      const phones = val("st-phones")
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const addr = {
        line1: val("st-addr1"),
        line2: val("st-addr2") || undefined,
        city: val("st-city"),
        state: val("st-addr-state") || undefined,
        postalCode: val("st-postal"),
        country: val("st-country").toUpperCase(),
      };
      const email = val("st-email");
      const anySeller =
        legal || addr.line1 || addr.city || addr.postalCode || email || phones.length;
      patch = { siteName };
      // All-blank seller block with no existing seller means "not set"; otherwise validate it.
      if (anySeller || seller) {
        patch.sellerDetails = { name: legal, address: addr, contactPhones: phones, email };
      }
    } else if (section === "currencies") {
      patch = {
        baseCurrency,
        enabledCurrencies: CURRENCIES.filter(
          (c) => c === baseCurrency || enabledCurrencies.includes(c),
        ),
      };
      // Only send the base currency when it changed — the server refuses any write to it once a
      // paid order exists, even an unchanged one.
      if (baseCurrency === s.currencies.base) delete patch.baseCurrency;
    } else if (section === "tax") {
      const gstin = val("st-gstin").toUpperCase();
      patch = {
        gstin: gstin === "" ? null : gstin,
        taxRateBps: Math.round(Number(val("st-rate")) * 100),
      };
      // Seller state lives in sellerDetails.address (no dedicated key) - patch it in place.
      const seller = s.tax.seller;
      const sellerState = val("st-state");
      if (seller && sellerState !== (seller.address.state ?? "")) {
        patch.sellerDetails = {
          ...seller,
          address: { ...seller.address, state: sellerState === "" ? undefined : sellerState },
        };
      }
    } else if (section === "ai") {
      patch = {
        aiModel: val("st-model"),
        aiDailyPlatformCap: Number(val("st-cap")),
        aiDailyUserCap: Number(val("st-user-cap")),
        chatTimeoutMs: Math.round(Number(val("st-timeout")) * 1000),
      };
    } else if (section === "retention") {
      patch = {
        retention: { chatMonths: Number(val("rt-chat")), recordsYears: s.retention.recordYears },
      };
    } else if (section === "theme") {
      patch = {
        defaultTheme: theme as SiteSettings["defaultTheme"],
        themeToggle,
        palette: palette as SiteSettings["palette"],
      };
    } else {
      return;
    }
    setSaving(true);
    try {
      const res = await updateSettings({ patch });
      if (!res.ok) {
        setFieldErrors(mapSettingsFieldErrors(res.error.fieldErrors));
        toast.error(res.error.message);
        return;
      }
      setFieldErrors({});
      toast.success("Settings saved", { description: "View in audit log" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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
            {SECTIONS.filter(([k]) => k !== "danger" || isSuperAdmin).map(([k, label]) => (
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
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          key={`${section}-${formVersion}`}
        >
          <h2 className="text-h3">{title}</h2>

          {ro ? (
            <p role="status" className="text-body-sm text-fg-muted">
              Read-only: only a super admin can change settings.
            </p>
          ) : null}

          {section === "general" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: seller details appear on every invoice; the site name is shown in
                the site header and footer, browser tab titles, the admin sidebar and email
                subjects.
              </p>
              <SiteLogoField logo={s.general.siteLogo} ro={ro} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="st-site"
                  label="Site name"
                  required
                  hint="Header, footer, page titles, admin sidebar and emails. Applies on save."
                  error={fieldErrors["st-site"]}
                >
                  <Input id="st-site" defaultValue={s.general.siteName} disabled={ro} />
                </Field>
                <Field
                  id="st-domain"
                  label="Domain"
                  hint="Read-only. Set by the hosting environment (NEXT_PUBLIC_SITE_URL); used for links in emails, sitemap and canonical URLs."
                >
                  <Input id="st-domain" value={s.general.domain} readOnly className="font-mono" />
                </Field>
                <Field id="st-legal" label="Legal name" required error={fieldErrors["st-legal"]}>
                  <Input id="st-legal" defaultValue={s.general.legalName} disabled={ro} />
                </Field>
                <Field
                  id="st-phones"
                  label="Contact phones"
                  hint="Invoice-only; never shown on the site. Comma-separated."
                  error={fieldErrors["st-phones"]}
                >
                  <Input id="st-phones" defaultValue={s.general.phones} disabled={ro} />
                </Field>
                <Field
                  id="st-addr1"
                  label="Address line 1"
                  required
                  error={fieldErrors["st-addr1"]}
                  className="sm:col-span-2"
                >
                  <Input
                    id="st-addr1"
                    defaultValue={s.tax.seller?.address.line1 ?? ""}
                    disabled={ro}
                  />
                </Field>
                <Field id="st-addr2" label="Address line 2" optional>
                  <Input
                    id="st-addr2"
                    defaultValue={s.tax.seller?.address.line2 ?? ""}
                    disabled={ro}
                  />
                </Field>
                <Field id="st-city" label="City" required error={fieldErrors["st-city"]}>
                  <Input
                    id="st-city"
                    defaultValue={s.tax.seller?.address.city ?? ""}
                    disabled={ro}
                  />
                </Field>
                <Field id="st-addr-state" label="State" optional>
                  <Input
                    id="st-addr-state"
                    defaultValue={s.tax.seller?.address.state ?? ""}
                    disabled={ro}
                  />
                </Field>
                <Field id="st-postal" label="Postal code" required error={fieldErrors["st-postal"]}>
                  <Input
                    id="st-postal"
                    defaultValue={s.tax.seller?.address.postalCode ?? ""}
                    disabled={ro}
                  />
                </Field>
                <Field
                  id="st-country"
                  label="Country (ISO code)"
                  required
                  hint="e.g. IN"
                  error={fieldErrors["st-country"]}
                >
                  <Input
                    id="st-country"
                    defaultValue={s.tax.seller?.address.country ?? ""}
                    disabled={ro}
                    maxLength={2}
                  />
                </Field>
                <Field
                  id="st-email"
                  label="Email"
                  hint="Invoice-only."
                  error={fieldErrors["st-email"]}
                >
                  <Input id="st-email" defaultValue={s.general.email} disabled={ro} />
                </Field>
              </div>
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
                hint="Changing the base currency is refused once a paid order exists."
                error={fieldErrors["st-base"]}
              >
                <Select
                  value={baseCurrency}
                  onValueChange={(v) => {
                    setBaseCurrency(v as typeof baseCurrency);
                    setEnabledCurrencies((prev) =>
                      prev.includes(v as never) ? prev : [...prev, v as never],
                    );
                  }}
                  disabled={ro}
                >
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
              </Field>
              <fieldset className="space-y-2">
                <legend className="text-body-sm font-semibold">Enabled display currencies</legend>
                <div className="flex flex-wrap gap-4">
                  {CURRENCIES.map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <Checkbox
                        id={`cur-${c}`}
                        checked={enabledCurrencies.includes(c)}
                        disabled={c === baseCurrency || ro}
                        onCheckedChange={(v) =>
                          setEnabledCurrencies((prev) =>
                            v === true
                              ? prev.includes(c)
                                ? prev
                                : [...prev, c]
                              : prev.filter((x) => x !== c),
                          )
                        }
                      />
                      <Label htmlFor={`cur-${c}`}>{c}</Label>
                    </div>
                  ))}
                </div>
                {fieldErrors["st-currencies"] ? (
                  <p className="text-caption text-danger">{fieldErrors["st-currencies"]}</p>
                ) : null}
              </fieldset>
              <p className="text-body-sm text-fg-muted">
                Visitors can switch the display currency in the site header; non-INR prices use the
                daily FX rate.
              </p>
            </>
          ) : null}

          {section === "tax" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: tax applies only to tax-enabled products and only once a GSTIN is
                set.
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
                <Field
                  id="st-state"
                  label="Seller state"
                  hint={
                    s.tax.seller
                      ? "Decides CGST/SGST vs IGST."
                      : "Add seller details (name and address) first to set the seller state."
                  }
                >
                  <Input
                    id="st-state"
                    defaultValue={s.tax.sellerState}
                    disabled={ro || !s.tax.seller}
                  />
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
              <ManualPaymentSettings payments={s.payments} ro={ro} />
              <RazorpaySection razorpay={s.payments.razorpay} ro={ro} />
              {s.payments.affectedOfferings.length > 0 ? (
                <Banner tone="warning">
                  Disabling a method used by active offerings affects:{" "}
                  {s.payments.affectedOfferings.join(", ")}.
                </Banner>
              ) : null}
            </>
          ) : null}

          {section === "theme" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: the default theme is what visitors see before they toggle.
              </p>
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="grid gap-3 sm:grid-cols-2"
                disabled={ro}
              >
                <RadioGroupCard value="dark-cinematic">
                  <span className="text-body font-semibold">Dark cinematic</span>
                  <span className="text-caption text-fg-muted">Default theme.</span>
                  <span
                    aria-hidden
                    className="mt-2 block h-16 rounded-sm border border-border"
                    style={{
                      // eslint-disable-next-line codekraft/no-hardcoded-colors -- theme preview swatch
                      background: "oklch(0.20 0.02 270)",
                    }}
                  />
                </RadioGroupCard>
                <RadioGroupCard value="light-editorial">
                  <span className="text-body font-semibold">Light editorial</span>
                  <span className="text-caption text-fg-muted">Warm paper, dark text.</span>
                  <span
                    aria-hidden
                    className="mt-2 block h-16 rounded-sm border border-border"
                    style={{
                      // eslint-disable-next-line codekraft/no-hardcoded-colors -- theme preview swatch
                      background: "oklch(0.96 0.01 90)",
                    }}
                  />
                </RadioGroupCard>
              </RadioGroup>
              <div className="flex items-center gap-3">
                <Switch
                  id="st-theme-toggle"
                  checked={themeToggle}
                  onCheckedChange={setThemeToggle}
                  disabled={ro}
                />
                <Label htmlFor="st-theme-toggle">
                  Let visitors switch theme from the site footer
                </Label>
              </div>
              <RadioGroup
                value={palette}
                onValueChange={setPalette}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                disabled={ro}
                aria-label="Accent palette"
              >
                {PALETTES.map((p) => (
                  <RadioGroupCard key={p.id} value={p.id}>
                    <span className="text-body font-semibold">{p.label}</span>
                    <span
                      aria-hidden
                      className="mt-2 flex h-8 overflow-hidden rounded-sm border border-border"
                    >
                      <span className="flex-1" style={{ background: p.dark }} />
                      <span className="flex-1" style={{ background: p.light }} />
                    </span>
                  </RadioGroupCard>
                ))}
              </RadioGroup>
              <p className="text-body-sm text-fg-muted">
                Accent palette applies across the site, account and admin. Left swatch is used on
                dark, right on light.
              </p>
            </>
          ) : null}

          {section === "ai" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: daily caps protect cost; a cap of 0 turns AI answers off.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="st-model"
                  label="Default model"
                  hint="Cheapest first. New chats use this model."
                >
                  <select
                    id="st-model"
                    defaultValue={s.ai.model}
                    disabled={ro}
                    className="border-input bg-bg h-10 w-full rounded-md border px-3 font-mono text-sm"
                  >
                    {!CHAT_MODELS.some((m) => m.id === s.ai.model) ? (
                      <option value={s.ai.model}>{s.ai.model}</option>
                    ) : null}
                    {CHAT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {chatModelOptionLabel(m)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id="st-cap"
                  label="Platform daily message cap"
                  required
                  error={fieldErrors["st-cap"]}
                >
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
                <Field
                  id="st-user-cap"
                  label="Per-user daily cap"
                  required
                  error={fieldErrors["st-user-cap"]}
                >
                  <Input
                    id="st-user-cap"
                    inputMode="numeric"
                    defaultValue={s.ai.perUserCap}
                    className="font-mono"
                    disabled={ro}
                  />
                </Field>
                <Field id="st-timeout" label="Timeout (s)" error={fieldErrors["st-timeout"]}>
                  <Input
                    id="st-timeout"
                    inputMode="numeric"
                    defaultValue={s.ai.timeoutS}
                    className="font-mono"
                    disabled={ro}
                  />
                </Field>
              </div>
              <Button asChild variant="link" size="sm">
                <a href={chatbotHref}>Chatbot › Prompts</a>
              </Button>
            </>
          ) : null}

          {section === "notifications" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Customers receive notifications by email and in-app; admins receive them in-app
                only. WhatsApp is controlled by the &ldquo;whatsapp_channel&rdquo; feature flag
                (currently {s.notifications.whatsapp ? "on" : "off"}).
              </p>
              <Field id="nt-sender" label="Email sender" hint="Set by the hosting environment.">
                <Input
                  id="nt-sender"
                  readOnly
                  value={s.notifications.sender}
                  className="font-mono"
                />
              </Field>
            </>
          ) : null}

          {section === "flags" ? (
            <>
              <p className="text-body-sm text-fg-muted">
                Why this matters: flags switch optional features on or off. Changes save immediately
                and are audited.
              </p>
              <div className="rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">Feature flags</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flag</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.flags
                      .filter((f) => !f.placeholder && !HIDDEN_FLAGS.has(f.key))
                      .map((f) => (
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
                            {f.dependency ? (
                              <span className="block text-caption text-fg-muted">
                                {f.dependency}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Switch
                              id={`flag-${f.key}`}
                              checked={flagValues[f.key] ?? f.enabled}
                              disabled={ro || f.envOverride || savingFlag === f.key}
                              aria-label={`${f.key} enabled`}
                              onCheckedChange={(v) => {
                                if (f.key === "three_hero" && !v) {
                                  setDangerous("Turn off the 3D hero?");
                                  return;
                                }
                                void saveFlag(f.key, v);
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
                <Field
                  id="rt-chat"
                  label="Chat transcripts (months)"
                  error={fieldErrors["rt-chat"]}
                >
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
              <p className="text-body-sm text-fg-muted">
                Personal data is anonymised immediately when a customer deletes their account.
              </p>
            </>
          ) : null}

          {section === "danger" && isSuperAdmin ? (
            <DangerZoneSection siteName={s.general.siteName} />
          ) : null}

          {saveable ? (
            <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-canvas px-4 py-3 lg:-mx-6 lg:px-6">
              <span className="text-caption text-fg-muted">
                Changes are audited with before/after.
              </span>
              <span className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={ro || saving}
                  onClick={() => {
                    setFieldErrors({});
                    resetSectionState();
                    setFormVersion((n) => n + 1);
                  }}
                >
                  Discard
                </Button>
                <Button size="sm" disabled={ro || saving} onClick={() => void handleSave()}>
                  Save changes
                </Button>
              </span>
            </div>
          ) : null}
        </form>
      </div>

      <Dialog open={dangerous !== null} onOpenChange={(o) => !o && setDangerous(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dangerous}</DialogTitle>
            <DialogDescription>
              {dangerous?.startsWith("Switch")
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
                if (dangerous?.startsWith("Turn off the 3D hero"))
                  void saveFlag("three_hero", false);
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
