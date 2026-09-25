"use client";

import { InvoicesScreen } from "@/components/account/InvoicesScreen";
import { invoices, payments } from "../../_fixtures/account";
import { orderHref } from "../_links";

export function Preview({ state }: { state: string }) {
  const empty = state === "empty";
  return (
    <InvoicesScreen
      invoices={empty ? [] : invoices}
      payments={empty ? [] : payments}
      financialYears={["2026-27", "2025-26"]}
      links={{ order: orderHref }}
      loading={state === "loading"}
      error={state === "error" ? "Couldn't load invoices." : null}
      pdfError={state === "pdf-error"}
    />
  );
}
