"use client";

import { CheckIcon, CircleIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/components/ui/_utils";

export interface PasswordCheck {
  id: string;
  label: string;
  ok: boolean;
}

/** Register/reset policy (SCR-AUTH-02): min 10 chars plus a mix of character classes. */
export function passwordChecks(value: string): PasswordCheck[] {
  return [
    { id: "length", label: "At least 10 characters", ok: value.length >= 10 },
    {
      id: "case",
      label: "Upper and lower case letters",
      ok: /[a-z]/.test(value) && /[A-Z]/.test(value),
    },
    { id: "number", label: "A number", ok: /\d/.test(value) },
    { id: "symbol", label: "A symbol", ok: /[^A-Za-z0-9]/.test(value) },
  ];
}

export function passwordStrength(value: string): {
  label: "Weak" | "Good" | "Strong";
  percent: number;
} {
  const passed = passwordChecks(value).filter((c) => c.ok).length;
  if (value.length === 0) return { label: "Weak", percent: 0 };
  if (passed <= 2) return { label: "Weak", percent: 30 };
  if (passed === 3) return { label: "Good", percent: 65 };
  return { label: value.length >= 14 ? "Strong" : "Good", percent: value.length >= 14 ? 100 : 80 };
}

/** Live rule checklist + strength meter with a text equivalent (WCAG: never colour alone). */
export function PasswordRules({ value, id }: { value: string; id?: string }) {
  const checks = passwordChecks(value);
  const strength = passwordStrength(value);
  return (
    <div id={id} className="space-y-2">
      <div className="flex items-center gap-3">
        <Progress
          value={strength.percent}
          aria-label={`Password strength: ${strength.label}`}
          className={cn(
            "h-1.5 flex-1",
            strength.label === "Weak" && "[&_[data-slot=progress-indicator]]:bg-danger",
            strength.label === "Good" && "[&_[data-slot=progress-indicator]]:bg-warning",
            strength.label === "Strong" && "[&_[data-slot=progress-indicator]]:bg-success",
          )}
        />
        <span
          className="w-14 text-right text-caption font-semibold text-fg-muted"
          aria-live="polite"
        >
          {value ? strength.label : ""}
        </span>
      </div>
      <ul className="grid gap-1 text-caption sm:grid-cols-2" aria-live="polite">
        {checks.map((c) => (
          <li
            key={c.id}
            className={cn("flex items-center gap-1.5", c.ok ? "text-success" : "text-fg-muted")}
          >
            {c.ok ? (
              <CheckIcon aria-hidden className="size-3.5" />
            ) : (
              <CircleIcon aria-hidden className="size-3.5" />
            )}
            <span>
              {c.label}
              <span className="sr-only">{c.ok ? " — met" : " — not met"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
