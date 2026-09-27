"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Currency } from "@/lib/money";
import { updateMyNotificationPreferences } from "@/modules/notifications/site-mutations";
import {
  changeMyPassword,
  deleteMyAccount,
  requestMyEmailChange,
  signOutMyOtherSessions,
  updateMyAccountSettings,
  updateMyProfile,
} from "@/modules/users/site-mutations";
import { Banner } from "./Banner";
import { BillingFields } from "./CheckoutScreen";
import { ConfirmDialog } from "./ConfirmDialog";
import { CurrencySelect } from "./CurrencySelect";
import { formatDateTime, relativeTime } from "./format";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules } from "./PasswordRules";
import type { AuthEvent, BillingDetails, CustomerProfile, SessionInfo } from "./types";

const EVENT_LABEL: Record<AuthEvent["kind"], string> = {
  login: "Signed in",
  logout: "Signed out",
  password_reset: "Password reset",
  session_replaced: "Session replaced by a new sign-in",
};

/**
 * SCR-ACC-09 — profile & settings: vertical tabs (Profile · Preferences · Security · Notifications ·
 * Delete account). Preferences auto-save; theme radio is hidden while `theme_light_editorial` is off.
 */
export function SettingsScreen({
  profile,
  session,
  authEvents,
  now,
  themeFlagOn = false,
  phoneOtpOn = false,
  deleteBlocked = false,
  loading = false,
}: {
  profile: CustomerProfile;
  session: SessionInfo;
  authEvents: AuthEvent[];
  now: string;
  themeFlagOn?: boolean;
  phoneOtpOn?: boolean;
  /** `STATE_INVALID`: a service delivery is in progress. */
  deleteBlocked?: boolean;
  loading?: boolean;
}) {
  const router = useRouter();
  const [billing, setBilling] = React.useState<BillingDetails>(profile.billing);
  const [currency, setCurrency] = React.useState<Currency>(profile.displayCurrency);
  const [theme, setTheme] = React.useState(profile.themePref ?? "dark-cinematic");
  const [reduce, setReduce] = React.useState(profile.reduceMotion);
  const [newPw, setNewPw] = React.useState("");
  const [updates, setUpdates] = React.useState(profile.emailProductUpdates);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [signingOutEverywhere, setSigningOutEverywhere] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [emailChangePw, setEmailChangePw] = React.useState("");
  const [sendingVerification, setSendingVerification] = React.useState(false);
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [savingNotificationPref, setSavingNotificationPref] = React.useState(false);
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const [deleteAccountPw, setDeleteAccountPw] = React.useState("");

  function billingInput(b: BillingDetails) {
    const hasAddress = Boolean(b.line1 && b.city && b.postalCode);
    return {
      billingName: b.name,
      company: b.company || undefined,
      address: hasAddress
        ? {
            line1: b.line1!,
            line2: b.line2 || undefined,
            city: b.city!,
            state: b.state || undefined,
            postalCode: b.postalCode!,
            country: b.country,
          }
        : undefined,
      country: b.country,
      gstNumber: b.gstNumber || undefined,
    };
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-fg">Settings</h1>
      <Tabs defaultValue="profile" className="flex-col gap-6 lg:flex-row lg:items-start">
        <TabsList
          variant="line"
          className="-mx-4 w-[calc(100%+2rem)] justify-start overflow-x-auto px-4 lg:mx-0 lg:h-auto! lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-visible lg:items-stretch lg:gap-1 lg:border-r lg:border-b-0 lg:px-0 lg:pr-4"
        >
          <TabsTrigger
            value="profile"
            className="lg:h-10 lg:flex-none lg:justify-start lg:after:hidden"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="lg:h-10 lg:flex-none lg:justify-start lg:after:hidden"
          >
            Preferences
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="lg:h-10 lg:flex-none lg:justify-start lg:after:hidden"
          >
            Security
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="lg:h-10 lg:flex-none lg:justify-start lg:after:hidden"
          >
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="delete"
            className="text-danger lg:h-10 lg:flex-none lg:justify-start lg:after:hidden"
          >
            Delete account
          </TabsTrigger>
        </TabsList>

        <div className="min-w-0 max-w-[640px] flex-1">
          <TabsContent value="profile">
            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const name = String(form.get("name") ?? "").trim();
                if (!name) return;
                setSavingProfile(true);
                const result = await updateMyProfile({ name, billing: billingInput(billing) });
                setSavingProfile(false);
                if (!result.ok) {
                  toast.error(result.error.message);
                  return;
                }
                toast.success("Profile saved");
                router.refresh();
              }}
            >
              <section className="space-y-4">
                <h2 className="text-h3 text-fg">Profile</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pf-name" required>
                      Full name
                    </Label>
                    <Input
                      id="pf-name"
                      name="name"
                      defaultValue={profile.name}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pf-email">Email</Label>
                    <div className="flex gap-2">
                      <Input id="pf-email" type="email" readOnly value={profile.email} />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button type="button" variant="secondary">
                            Change
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Change email</DialogTitle>
                            <DialogDescription>
                              We&apos;ll send a verification link to the new address; your current
                              email stays active until you open it.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="ce-new" required>
                                New email
                              </Label>
                              <Input
                                id="ce-new"
                                type="email"
                                autoComplete="email"
                                required
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ce-pw" required>
                                Current password
                              </Label>
                              <PasswordInput
                                id="ce-pw"
                                autoComplete="current-password"
                                required
                                value={emailChangePw}
                                onChange={(e) => setEmailChangePw(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="ghost">Cancel</Button>
                            </DialogClose>
                            <Button
                              disabled={sendingVerification}
                              onClick={async () => {
                                const trimmed = newEmail.trim();
                                if (!trimmed || !emailChangePw) return;
                                setSendingVerification(true);
                                const result = await requestMyEmailChange({
                                  newEmail: trimmed,
                                  currentPassword: emailChangePw,
                                });
                                setSendingVerification(false);
                                if (!result.ok) {
                                  toast.error(result.error.message);
                                  return;
                                }
                                setNewEmail("");
                                setEmailChangePw("");
                                toast.success("Verification sent to the new address");
                              }}
                            >
                              {sendingVerification ? "Sending…" : "Send verification"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {phoneOtpOn ? (
                    <div className="space-y-2">
                      <Label htmlFor="pf-phone">Phone</Label>
                      <Input
                        id="pf-phone"
                        type="tel"
                        defaultValue={profile.phone ?? ""}
                        autoComplete="tel"
                      />
                    </div>
                  ) : null}
                </div>
              </section>
              <section className="space-y-4">
                <h2 className="text-h4 text-fg">Billing details</h2>
                <BillingFields value={billing} onChange={setBilling} idPrefix="pf" />
              </section>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="preferences">
            <div className="space-y-8">
              <h2 className="text-h3 text-fg">Preferences</h2>
              <div className="space-y-2">
                <Label htmlFor="pref-currency">Display currency</Label>
                <CurrencySelect
                  id="pref-currency"
                  size="default"
                  value={currency}
                  onChange={async (c) => {
                    setCurrency(c);
                    const result = await updateMyAccountSettings({ displayCurrency: c });
                    if (!result.ok) {
                      toast.error(result.error.message);
                      return;
                    }
                    toast.success(`Prices now shown in ${c}`);
                  }}
                  className="w-40"
                />
                <p className="text-caption text-fg-muted">
                  You&apos;re charged in INR; other currencies are shown as estimates.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-body-sm font-semibold text-fg">Theme</p>
                {themeFlagOn ? (
                  <RadioGroup
                    value={theme}
                    onValueChange={async (v) => {
                      const next = v as typeof theme;
                      setTheme(next);
                      const result = await updateMyAccountSettings({ themePref: next });
                      if (!result.ok) {
                        toast.error(result.error.message);
                        return;
                      }
                      toast.success("Theme saved");
                    }}
                    aria-label="Theme"
                    className="grid gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="th-dark" value="dark-cinematic" />
                      <Label htmlFor="th-dark" className="font-medium">
                        Dark cinematic
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="th-light" value="light-editorial" />
                      <Label htmlFor="th-light" className="font-medium">
                        Light editorial
                      </Label>
                    </div>
                  </RadioGroup>
                ) : (
                  <p className="text-body-sm text-fg-muted">
                    Theme: Dark cinematic{" "}
                    <span className="text-fg-subtle">
                      — the Light editorial theme arrives with a later release.
                    </span>
                  </p>
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="pref-motion" className="font-semibold">
                    Reduce motion
                  </Label>
                  <p className="text-caption text-fg-muted">
                    Mirrors your system preference; turn on to override it here.
                  </p>
                </div>
                <Switch
                  id="pref-motion"
                  checked={reduce}
                  onCheckedChange={(v) => {
                    setReduce(v);
                    toast.success(v ? "Motion reduced" : "Motion restored");
                  }}
                />
              </div>
              <p className="text-caption text-fg-subtle">
                Currency and theme save automatically. Reduce motion is remembered on this device
                only.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className="space-y-8">
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const currentPassword = String(form.get("currentPassword") ?? "");
                  const confirmPassword = String(form.get("confirmPassword") ?? "");
                  if (newPw !== confirmPassword) {
                    toast.error("New password and confirmation don't match");
                    return;
                  }
                  setChangingPassword(true);
                  const result = await changeMyPassword({
                    currentPassword,
                    newPassword: newPw,
                    revokeOtherSessions: true,
                  });
                  setChangingPassword(false);
                  if (!result.ok) {
                    toast.error(result.error.message);
                    return;
                  }
                  setNewPw("");
                  e.currentTarget.reset();
                  toast.success("Password changed");
                }}
              >
                <h2 className="text-h3 text-fg">Change password</h2>
                <div className="space-y-2">
                  <Label htmlFor="sec-current" required>
                    Current password
                  </Label>
                  <PasswordInput
                    id="sec-current"
                    name="currentPassword"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sec-new" required>
                    New password
                  </Label>
                  <PasswordInput
                    id="sec-new"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    aria-describedby="sec-rules"
                  />
                  <PasswordRules value={newPw} id="sec-rules" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sec-confirm" required>
                    Confirm new password
                  </Label>
                  <PasswordInput
                    id="sec-confirm"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword ? "Updating…" : "Update password"}
                </Button>
              </form>

              <Card className="gap-4 py-5">
                <CardHeader className="px-5">
                  <CardTitle>Active session</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-5 text-body-sm">
                  <p className="text-fg">{session.device}</p>
                  <p className="text-fg-muted">
                    IP {session.ip} · last active {relativeTime(session.lastActiveAt, now)}
                  </p>
                  <p className="text-caption text-fg-muted">
                    Only one session is active at a time; signing in elsewhere signs this one out.
                  </p>
                  <ConfirmDialog
                    trigger={
                      <Button variant="secondary" size="sm" disabled={signingOutEverywhere}>
                        Sign out other sessions
                      </Button>
                    }
                    title="Sign out other sessions?"
                    description="This device's session stays signed in; any other active session is ended."
                    confirmLabel="Sign out other sessions"
                    destructive={false}
                    onConfirm={async () => {
                      setSigningOutEverywhere(true);
                      const result = await signOutMyOtherSessions();
                      setSigningOutEverywhere(false);
                      if (!result.ok) {
                        toast.error(result.error.message);
                        return;
                      }
                      toast.success(
                        result.data.revoked > 0
                          ? `Signed out of ${result.data.revoked} other session${result.data.revoked === 1 ? "" : "s"}`
                          : "No other sessions were active",
                      );
                    }}
                  />
                </CardContent>
              </Card>

              <section className="space-y-2">
                <h2 className="text-h4 text-fg">Recent sign-ins</h2>
                {authEvents.length === 0 ? (
                  <p className="text-body-sm text-fg-muted">No recent sign-ins</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-body-sm">
                    {authEvents.slice(0, 5).map((e) => (
                      <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                        <span className="text-fg">
                          {EVENT_LABEL[e.kind]} <span className="text-fg-muted">· {e.device}</span>
                        </span>
                        <time dateTime={e.at} className="text-caption text-fg-subtle">
                          {formatDateTime(e.at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <h2 className="text-h3 text-fg">Email notifications</h2>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="nt-orders" className="font-semibold">
                    Order and payment updates
                  </Label>
                  <p className="text-caption text-fg-muted">
                    Always on — receipts, confirmations and delivery notices are part of your
                    purchase.
                  </p>
                </div>
                <Switch id="nt-orders" checked disabled aria-readonly />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="nt-updates" className="font-semibold">
                    Product updates for products you own
                  </Label>
                  <p className="text-caption text-fg-muted">New versions and changelogs.</p>
                </div>
                <Switch
                  id="nt-updates"
                  checked={updates}
                  disabled={savingNotificationPref}
                  onCheckedChange={async (v) => {
                    setUpdates(v);
                    setSavingNotificationPref(true);
                    const result = await updateMyNotificationPreferences({
                      email: { orderUpdates: true, productUpdates: v },
                    });
                    setSavingNotificationPref(false);
                    if (!result.ok) {
                      setUpdates(!v);
                      toast.error(result.error.message);
                      return;
                    }
                    toast.success("Preference saved");
                  }}
                />
              </div>
              <p className="text-caption text-fg-subtle">
                In-app notifications are always on. There is no marketing email.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="delete">
            <div className="space-y-4 rounded-lg border border-danger bg-danger-soft/30 p-5">
              <h2 className="text-h3 text-danger">Delete account</h2>
              <ul className="list-disc space-y-1 pl-5 text-body-sm text-fg-muted">
                <li>
                  Your personal data is anonymised <strong className="text-fg">immediately</strong>{" "}
                  — there is no grace window.
                </li>
                <li>
                  Orders, invoices and payment records are retained for 7 years as required by law,
                  without your name.
                </li>
                <li>
                  Active subscriptions are cancelled at the end of their current period; downloads
                  and keys stop working.
                </li>
              </ul>
              {deleteBlocked ? (
                <Banner tone="danger">
                  A service delivery is in progress — open a query to close it first.
                </Banner>
              ) : null}
              <div className="flex items-center gap-2">
                <Checkbox id="del-ack" />
                <Label htmlFor="del-ack" className="font-medium">
                  I understand this can&apos;t be undone
                </Label>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" disabled={deleteBlocked || deletingAccount}>
                    Delete my account
                  </Button>
                }
                title="Delete your account?"
                description="This anonymises your profile right away and signs you out. Purchases can't be recovered afterwards."
                confirmLabel="Delete my account"
                typeToConfirm="DELETE"
                onConfirm={async (typed) => {
                  if (typed !== "DELETE") return;
                  setDeletingAccount(true);
                  const result = await deleteMyAccount({
                    password: deleteAccountPw || undefined,
                    confirmPhrase: "DELETE",
                  });
                  setDeletingAccount(false);
                  if (!result.ok) {
                    toast.error(result.error.message);
                    return;
                  }
                  toast.success("Your account has been deleted");
                  window.location.href = "/";
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="del-pw" required>
                    Password
                  </Label>
                  <PasswordInput
                    id="del-pw"
                    autoComplete="current-password"
                    required
                    value={deleteAccountPw}
                    onChange={(e) => setDeleteAccountPw(e.target.value)}
                  />
                </div>
              </ConfirmDialog>
              <p className="text-caption text-fg-subtle">
                Questions first?{" "}
                <Link href="/account/queries" className="text-accent-text underline">
                  Open a query
                </Link>
                .
              </p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
