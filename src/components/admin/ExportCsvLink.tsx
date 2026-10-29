"use client";

import { DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

/** Downloads the server CSV for the screen's current URL filters (`/api/admin/export/<kind>`). */
export function ExportCsvLink({ kind }: Readonly<{ kind: "ledger" | "expenses" }>) {
  const qs = useSearchParams().toString();
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/admin/export/${kind}${qs ? `?${qs}` : ""}`} download>
        <DownloadIcon aria-hidden /> Export CSV
      </a>
    </Button>
  );
}
