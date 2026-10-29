"use client";

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolbarField } from "../DataToolbar";
import type { useUrlFilters } from "./use-url-filters";

/** Toolbar select bound to one URL search param; the first item clears it. */
export function UrlSelect({
  id,
  label,
  param,
  f,
  width = "w-40",
  anyLabel = "Any",
  children,
}: {
  id: string;
  label: string;
  param: string;
  f: ReturnType<typeof useUrlFilters>;
  width?: string;
  anyLabel?: string;
  children: ReactNode;
}) {
  return (
    <ToolbarField id={id} label={label}>
      <Select value={f.get(param) || "all"} onValueChange={(v) => f.set(param, v)}>
        <SelectTrigger id={id} size="sm" className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{anyLabel}</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </ToolbarField>
  );
}
