"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

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
import { cn } from "@/components/ui/_utils";
import { percentFromBps } from "../format";
import type { SplitLine } from "../types";

export interface SplitValue {
  companyCutBps: number;
  lines: SplitLine[];
}

/** Parses a percent string ("35.5") into basis points without floats in the result. */
function toBps(text: string): number {
  const m = /^\s*(\d{0,3})(?:\.(\d{0,2}))?\s*$/.exec(text);
  if (!m) return 0;
  const whole = m[1] ?? "";
  const frac = (m[2] ?? "").padEnd(2, "0");
  return Number.parseInt((whole === "" ? "0" : whole) + frac, 10);
}

/**
 * Ownership / split editor (SCR-ADM-04 tab 6, SCR-ADM-08 line splits): company cut + partner
 * rows in percent (stored as bps). The running total must equal 100.00 %; the total is announced
 * through a live region. Percentages are shown with two decimals (docs terminology).
 */
export function SplitEditor({
  value,
  onChange,
  partners,
  idPrefix,
  compact = false,
}: {
  value: SplitValue;
  onChange: (next: SplitValue) => void;
  partners: Array<{ id: string; name: string }>;
  idPrefix: string;
  compact?: boolean;
}) {
  const total = value.companyCutBps + value.lines.reduce((s, l) => s + l.bps, 0);
  const ok = total === 10000;
  const update = (patch: Partial<SplitValue>) => onChange({ ...value, ...patch });
  const setLine = (i: number, patch: Partial<SplitLine>) =>
    update({ lines: value.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="grid grid-cols-[1fr_120px_40px] items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-company`}>Company cut</Label>
          <Input id={`${idPrefix}-company`} readOnly value="CodeKraft (company)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-company-pct`}>%</Label>
          <Input
            id={`${idPrefix}-company-pct`}
            inputMode="decimal"
            className="text-right font-mono tnum"
            defaultValue={(value.companyCutBps / 100).toFixed(2)}
            onChange={(e) => update({ companyCutBps: toBps(e.target.value) })}
          />
        </div>
        <span />
      </div>
      {value.lines.map((line, i) => (
        <div
          key={`${line.partnerId}-${i}`}
          className="grid grid-cols-[1fr_120px_40px] items-end gap-2"
        >
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-partner-${i}`}>Partner {i + 1}</Label>
            <Select
              value={line.partnerId}
              onValueChange={(id) =>
                setLine(i, {
                  partnerId: id,
                  partnerName: partners.find((p) => p.id === id)?.name ?? "",
                })
              }
            >
              <SelectTrigger id={`${idPrefix}-partner-${i}`}>
                <SelectValue placeholder="Choose partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-pct-${i}`}>%</Label>
            <Input
              id={`${idPrefix}-pct-${i}`}
              inputMode="decimal"
              className="text-right font-mono tnum"
              defaultValue={(line.bps / 100).toFixed(2)}
              onChange={(e) => setLine(i, { bps: toBps(e.target.value) })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            aria-label={`Remove partner row ${i + 1}`}
            onClick={() => update({ lines: value.lines.filter((_, j) => j !== i) })}
          >
            <Trash2Icon aria-hidden className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            update({
              lines: [
                ...value.lines,
                { partnerId: partners[0]?.id ?? "", partnerName: partners[0]?.name ?? "", bps: 0 },
              ],
            })
          }
        >
          <PlusIcon aria-hidden /> Add partner
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={cn("font-mono text-body-sm tnum", ok ? "text-success" : "text-danger")}
        >
          Total {percentFromBps(total)}{" "}
          {ok
            ? "✔"
            : `— must equal 100.00 % (${total > 10000 ? "over" : "under"} by ${percentFromBps(Math.abs(10000 - total))})`}
        </p>
      </div>
    </div>
  );
}

/** Read-only summary line: "Company 20 % · Priya 50 % · Arjun 30 %". */
export function splitSummary(v: SplitValue): string {
  return [
    `Company ${(v.companyCutBps / 100).toFixed(0)} %`,
    ...v.lines.map((l) => `${l.partnerName.split(" ")[0]} ${(l.bps / 100).toFixed(0)} %`),
  ].join(" · ");
}
