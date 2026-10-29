"use client";

import { ChevronDownIcon, DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportColumn, ExportFormat } from "@/lib/admin/export-builder";

type Props =
  | { kind: "ledger" | "expenses" } // server export for the screen's current URL filters
  | { name: string; columns: ExportColumn[]; rows: readonly (readonly unknown[])[] }; // client-filtered rows

/** "Export" menu: Excel (.xlsx) or CSV, both built server-side by `lib/admin/export-builder`. */
export function ExportMenu(props: Readonly<Props>) {
  const qs = useSearchParams().toString();
  const [busy, setBusy] = React.useState(false);

  async function run(format: ExportFormat) {
    setBusy(true);
    try {
      const res =
        "kind" in props
          ? await fetch(`/api/admin/export/${props.kind}?${qs}${qs ? "&" : ""}format=${format}`)
          : await fetch("/api/admin/export/table", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                format,
                filename: props.name,
                columns: props.columns,
                rows: props.rows,
              }),
            });
      if (!res.ok) throw new Error(await res.text());
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
        `export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          <DownloadIcon aria-hidden /> Export <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run("csv")}>CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
