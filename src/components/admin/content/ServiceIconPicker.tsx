"use client";

import * as React from "react";

import { cn } from "@/components/ui/_utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SERVICE_ICONS,
  toServiceIcon,
  type ServiceIconName,
} from "@/components/site/service-icons";
import { ServiceIcon } from "@/components/site/ServiceIcon";

const COLS = 6;

/** Searchable icon grid + dark/light preview of the chosen icon on the accent tile. */
export function ServiceIconPicker({
  id,
  value,
  onChange,
}: Readonly<{ id?: string; value: string; onChange: (name: ServiceIconName) => void }>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const gridRef = React.useRef<HTMLDivElement>(null);
  const selected = toServiceIcon(value);
  const current = SERVICE_ICONS.find((i) => i.name === selected) ?? SERVICE_ICONS[0];
  const q = query.trim().toLowerCase();
  const items = SERVICE_ICONS.filter(
    (i) => !q || i.name.includes(q) || i.label.toLowerCase().includes(q),
  );

  function focusAt(i: number) {
    gridRef.current?.querySelectorAll<HTMLButtonElement>("button")[i]?.focus();
  }

  function onGridKey(e: React.KeyboardEvent, index: number) {
    const delta: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLS,
      ArrowUp: -COLS,
    };
    const d = delta[e.key];
    if (d === undefined) return;
    e.preventDefault();
    focusAt(Math.min(Math.max(index + d, 0), items.length - 1));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="w-full justify-start gap-2">
          <ServiceIcon name={selected} className="size-6 [&>svg]:size-4" />
          {current.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] space-y-3">
        <Input
          type="search"
          aria-label="Search icons"
          placeholder="Search icons"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusAt(0);
            }
          }}
        />
        <div
          ref={gridRef}
          role="group"
          aria-label="Icons"
          className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto"
        >
          {items.map((i, index) => (
            <button
              key={i.name}
              type="button"
              aria-label={i.label}
              aria-pressed={i.name === selected}
              title={i.label}
              onKeyDown={(e) => onGridKey(e, index)}
              onClick={() => {
                onChange(i.name);
                setOpen(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-fg-muted hover:bg-accent-soft hover:text-accent-text focus-visible:outline-2 focus-visible:outline-ring",
                i.name === selected && "border-accent bg-accent-soft text-accent-text",
              )}
            >
              <i.Icon aria-hidden className="size-5" />
              <span className="w-full truncate text-center text-[10px] leading-tight">
                {i.label}
              </span>
            </button>
          ))}
          {items.length === 0 && (
            <p className="col-span-6 py-4 text-center text-body-sm text-fg-muted">
              No icons match.
            </p>
          )}
        </div>
        <div aria-label="Preview palette" role="group" className="grid grid-cols-2 gap-2">
          {(["dark-cinematic", "light-editorial"] as const).map((theme) => (
            <div
              key={theme}
              data-theme={theme}
              className="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 text-fg"
            >
              <ServiceIcon name={selected} />
              <span className="text-caption text-fg-muted">
                {theme === "dark-cinematic" ? "Dark" : "Light"}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
