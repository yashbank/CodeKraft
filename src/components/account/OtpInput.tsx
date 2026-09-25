"use client";

import * as React from "react";

import { cn } from "@/components/ui/_utils";

/**
 * Six-box one-time-code input (docs/08 §6.2 "OTP input"): a single labelled group, each box
 * `aria-label="Digit n"`, auto-advance, backspace, paste and `autocomplete="one-time-code"`.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  label = "6-digit code",
  disabled = false,
  invalid = false,
  describedBy,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value.charAt(i));

  function setAt(index: number, char: string) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").slice(0, length));
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={d}
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, char);
            if (char && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) {
              refs.current[i - 1]?.focus();
              setAt(i - 1, "");
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!text) return;
            e.preventDefault();
            onChange(text);
            refs.current[Math.min(text.length, length - 1)]?.focus();
          }}
          className={cn(
            "h-14 w-11 rounded-md border border-border-strong bg-surface text-center font-mono text-[24px] text-fg transition-[border-color,box-shadow] outline-none sm:h-14 sm:w-12 pointer-coarse:h-12 pointer-coarse:w-11",
            "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-fg-subtle",
            invalid && "border-danger",
          )}
        />
      ))}
    </div>
  );
}
