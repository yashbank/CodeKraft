"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/_utils";

/** Searchable select (combobox) for one theme group: every option, typed filter, one-line note. */
export function ThemeSelect({
  label,
  note,
  value,
  ids,
  labelOf,
  onChange,
  disabled,
}: {
  label: string;
  note: string;
  value: string;
  ids: readonly string[];
  labelOf: (id: string) => string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="grid gap-1">
      <span className="text-body-sm font-medium">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{labelOf(value)}</span>
            <ChevronsUpDownIcon aria-hidden className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
          <Command>
            <CommandInput placeholder={`Search ${ids.length} options`} />
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              {ids.map((id) => (
                <CommandItem
                  key={id}
                  value={`${labelOf(id)} ${id}`}
                  onSelect={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    aria-hidden
                    className={cn(id === value ? "opacity-100" : "opacity-0")}
                  />
                  {labelOf(id)}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-caption text-fg-muted">{note}</p>
    </div>
  );
}
