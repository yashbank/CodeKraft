"use client";

import { CheckCircle2Icon, CircleAlertIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";

import type { InquiryResult, InquiryValues, ServiceOption } from "./types";

export type InquirySource = "inquiry_form" | "product_cta";

export interface InquiryFormProps {
  serviceOptions: ServiceOption[];
  /** `full` = /contact (adds budget hint + consent line); `compact` = sheet / landing chapter 5. */
  variant?: "full" | "compact";
  source?: InquirySource;
  /** Prefill (service interest from a "Discuss this service" CTA, message from case studies…). */
  defaults?: Partial<InquiryValues>;
  /** P7: the `createLead` Server Action. Default simulates a success after 600 ms. */
  onSubmit?: (values: InquiryValues, source: InquirySource) => Promise<InquiryResult>;
  /** Previews: render straight into a state. */
  initialStatus?: "idle" | "success" | "error" | "turnstile_down";
  /** Called after a successful submit (sheets close on "Done"). */
  onDone?: () => void;
  className?: string;
}

const BUDGETS = ["< ₹1 lakh", "₹1–5 lakh", "₹5–20 lakh", "> ₹20 lakh", "Not sure"];
const MESSAGE_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY: InquiryValues = {
  name: "",
  email: "",
  phone: "",
  company: "",
  serviceInterest: "",
  budget: "",
  message: "",
};

async function simulateSubmit(values: InquiryValues): Promise<InquiryResult> {
  await new Promise((r) => setTimeout(r, 600));
  const ref = values.email.length.toString(16).toUpperCase().padStart(2, "0");
  return { ok: true, reference: `CK-L-3F${ref}` };
}

/**
 * Inquiry form — SCR-SITE-09 (full page) and the shared `InquirySheet` (compact). Creates a lead
 * via `createLead` (API-LEAD-01) in P7. Validates on blur, shows a `role="alert"` summary, keeps
 * values on server error, replaces itself with a success panel (focus moves to its heading).
 * Turnstile is a labelled placeholder box until the widget lands (D-1204).
 */
export function InquiryForm({
  serviceOptions,
  variant = "compact",
  source = "inquiry_form",
  defaults,
  onSubmit = simulateSubmit,
  initialStatus = "idle",
  onDone,
  className,
}: InquiryFormProps) {
  const id = useId();
  const [values, setValues] = useState<InquiryValues>({ ...EMPTY, ...defaults });
  const [errors, setErrors] = useState<Partial<Record<keyof InquiryValues, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof InquiryValues, boolean>>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error" | "turnstile_down"
  >(initialStatus);
  const [result, setResult] = useState<InquiryResult | null>(
    initialStatus === "success" ? { ok: true, reference: "CK-L-3F9A" } : null,
  );
  const successHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status === "success") successHeading.current?.focus();
  }, [status]);

  function validate(v: InquiryValues) {
    const next: typeof errors = {};
    if (!v.name.trim()) next.name = "Enter your name";
    if (!EMAIL_RE.test(v.email)) next.email = "Enter a valid work email";
    if (!v.message.trim()) next.message = "Tell us a little about what you need";
    if (v.message.length > MESSAGE_MAX)
      next.message = `Keep it under ${String(MESSAGE_MAX)} characters`;
    return next;
  }

  function set<K extends keyof InquiryValues>(key: K, value: InquiryValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (touched[key]) setErrors(validate(next));
  }

  function blur(key: keyof InquiryValues) {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validate(values));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    setTouched({ name: true, email: true, message: true });
    if (Object.keys(next).length > 0) return;
    setStatus("submitting");
    const res = await onSubmit(values, source);
    setResult(res);
    setStatus(res.ok ? "success" : "error");
  }

  if (status === "success") {
    const firstName = values.name.trim().split(" ")[0] || "there";
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "ck-crossfade rounded-lg border border-border bg-surface p-6 shadow-1",
          className,
        )}
      >
        <CheckCircle2Icon aria-hidden className="size-10 text-success" />
        <h3 ref={successHeading} tabIndex={-1} className="mt-4 text-h3 outline-none">
          Thanks, {firstName}. Your inquiry is in.
        </h3>
        <p className="mt-2 text-body text-fg-muted">
          We&rsquo;ll reply to{" "}
          <span className="font-medium text-fg">{values.email || "your email"}</span> within 2
          working days.
        </p>
        {result?.reference ? (
          <p className="mt-2 font-mono text-body-sm text-fg-subtle select-all">
            Inquiry #{result.reference}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {onDone ? (
            <Button type="button" onClick={onDone}>
              Done
            </Button>
          ) : null}
          <Button asChild variant={onDone ? "ghost" : "secondary"}>
            <Link href="/products">Browse products</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/projects">See our work</Link>
          </Button>
        </div>
      </div>
    );
  }

  const errorEntries = Object.entries(errors).filter(([, v]) => Boolean(v));
  const turnstileDown = status === "turnstile_down";
  const busy = status === "submitting";
  const field = (k: keyof InquiryValues) => `${id}-${k}`;

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className={cn("space-y-5", className)}
      aria-busy={busy || undefined}
    >
      {errorEntries.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border-l-4 border-danger bg-danger-soft px-4 py-3 text-body-sm text-danger"
        >
          <p className="font-semibold">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {errorEntries.map(([k, msg]) => (
              <li key={k}>
                <a
                  href={`#${field(k as keyof InquiryValues)}`}
                  className="underline underline-offset-2"
                >
                  {msg}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border-l-4 border-danger bg-danger-soft px-4 py-3 text-body-sm text-danger"
        >
          <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Couldn&rsquo;t send — try again</p>
            <p>{result?.error ?? "Your details are still here."}</p>
          </div>
        </div>
      ) : null}

      {turnstileDown ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border-l-4 border-warning bg-warning-soft px-4 py-3 text-body-sm text-warning"
        >
          <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>Our form protection is temporarily unavailable — please try again shortly.</p>
        </div>
      ) : null}

      <div className={cn("grid gap-5", variant === "full" && "sm:grid-cols-2")}>
        <Field
          id={field("name")}
          label="Full name"
          required
          error={touched.name ? errors.name : undefined}
        >
          <Input
            id={field("name")}
            name="name"
            autoComplete="name"
            required
            aria-required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => blur("name")}
            disabled={busy}
          />
        </Field>
        <Field
          id={field("email")}
          label="Work email"
          required
          error={touched.email ? errors.email : undefined}
        >
          <Input
            id={field("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-required
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => blur("email")}
            disabled={busy}
          />
        </Field>
        <Field id={field("phone")} label="Phone (optional)">
          <Input
            id={field("phone")}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field id={field("company")} label="Company (optional)">
          <Input
            id={field("company")}
            name="company"
            autoComplete="organization"
            value={values.company}
            onChange={(e) => set("company", e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field id={field("serviceInterest")} label="What do you need?">
          <Select
            value={values.serviceInterest || undefined}
            onValueChange={(v) => set("serviceInterest", v)}
            disabled={busy}
          >
            <SelectTrigger id={field("serviceInterest")} className="w-full">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              {serviceOptions.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.title}
                </SelectItem>
              ))}
              <SelectItem value="other">Something else</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {variant === "full" ? (
          <Field
            id={field("budget")}
            label="Budget hint (optional)"
            hint="A hint, never a commitment."
          >
            <Select
              value={values.budget || undefined}
              onValueChange={(v) => set("budget", v)}
              disabled={busy}
            >
              <SelectTrigger id={field("budget")} className="w-full">
                <SelectValue placeholder="Choose a range" />
              </SelectTrigger>
              <SelectContent>
                {BUDGETS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field
          id={field("message")}
          label="Message"
          required
          error={touched.message ? errors.message : undefined}
          hint={`${String(values.message.length)} / ${String(MESSAGE_MAX)}`}
          className={variant === "full" ? "sm:col-span-2" : undefined}
        >
          <Textarea
            id={field("message")}
            name="message"
            required
            aria-required
            rows={variant === "full" ? 6 : 4}
            maxLength={MESSAGE_MAX}
            placeholder="What are you building, and by when?"
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            onBlur={() => blur("message")}
            disabled={busy}
          />
        </Field>
      </div>

      <div
        aria-label="Browser verification"
        className="flex items-center gap-3 rounded-md border border-dashed border-border-strong bg-canvas px-4 py-3 text-body-sm text-fg-muted"
      >
        <ShieldCheckIcon aria-hidden className="size-5 shrink-0 text-fg-subtle" />
        <span>Turnstile challenge (invisible) — widget lands in P7</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-fg-muted">
          By sending you agree to our{" "}
          <Link
            href="/legal/privacy"
            className="text-accent-text underline-offset-2 hover:underline"
          >
            Privacy policy
          </Link>
          . We reply by email within 2 working days.
        </p>
        <Button
          type="submit"
          size={variant === "full" ? "lg" : "md"}
          loading={busy}
          disabled={turnstileDown}
          className="sm:shrink-0"
        >
          Send inquiry
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
        {required ? <span className="sr-only"> (required)</span> : null}
      </Label>
      <div aria-invalid={error ? true : undefined} className="[&>*]:w-full">
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-caption text-danger">
          <CircleAlertIcon aria-hidden className="size-4" /> {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
