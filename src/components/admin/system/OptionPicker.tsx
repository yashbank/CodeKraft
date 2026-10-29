"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/components/ui/_utils";
import { useIsMobile } from "@/components/ui/_use-mobile";
import { inlineIds } from "@/lib/ui-style";

export interface PickerOption {
  id: string;
  label: string;
  /** Live mini preview shown on the card (inline and in the "Show all" list). */
  preview?: React.ReactNode;
}

/**
 * One option group (R9-08): current choice + popular ones inline (≤3), "Show all" opens a dialog
 * (≥768) or bottom sheet (<768) with every option, a live mini preview and optional search.
 */
export function OptionPicker({
  label,
  value,
  onChange,
  options,
  popular,
  searchable = false,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: PickerOption[];
  popular: readonly string[];
  searchable?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const mobile = useIsMobile();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // No Dialog/SheetTrigger is used, so Radix has no trigger to hand focus back to on close.
  const restoreFocus = (e: Event) => {
    e.preventDefault();
    triggerRef.current?.focus();
  };
  const ids = options.map((o) => o.id);
  const shown = inlineIds(value, popular, ids).flatMap((id) => options.filter((o) => o.id === id));
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !q || o.label.toLowerCase().includes(q));

  const body = (
    <>
      {searchable ? (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
          aria-label={`Search ${label.toLowerCase()}`}
        />
      ) : null}
      <ul
        aria-label={`All ${label.toLowerCase()} options`}
        className="grid max-h-[55vh] min-h-0 grid-cols-1 gap-2 overflow-y-auto overscroll-contain p-1 sm:grid-cols-2"
      >
        {matches.map((o) => (
          <li key={o.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                o.id === value && "border-accent bg-accent-soft",
              )}
            >
              <span className="text-body-sm font-semibold break-words">{o.label}</span>
              {o.preview}
            </button>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="text-body-sm text-fg-muted p-2">
            No {label.toLowerCase()} match “{query}”.
          </li>
        ) : null}
      </ul>
    </>
  );
  const title = `All ${label.toLowerCase()}`;
  const desc = `${options.length} options. Pick one to preview it; save to apply.`;

  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="text-body-sm mb-1 font-medium">{label}</legend>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0"
        disabled={disabled}
        aria-label={label}
      >
        {shown.map((o) => (
          <RadioGroupCard key={o.id} value={o.id} className="flex-col gap-2">
            <span className="text-body-sm font-semibold">{o.label}</span>
            {o.preview}
          </RadioGroupCard>
        ))}
      </RadioGroup>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          ref={triggerRef}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-label={`Show all ${label.toLowerCase()} (${options.length})`}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          Show all ({options.length})
        </Button>
      </div>
      {mobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[88svh] gap-3 p-4"
            onCloseAutoFocus={restoreFocus}
          >
            <SheetHeader className="p-0 pr-10">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{desc}</SheetDescription>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            size="md"
            className="max-h-[90svh] overflow-hidden"
            onCloseAutoFocus={restoreFocus}
          >
            <DialogHeader className="pr-8">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{desc}</DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </fieldset>
  );
}
