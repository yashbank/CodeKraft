/**
 * GET /api/admin/export/{ledger|expenses}?<same query string as the screen>
 * ?format=xlsx|csv (default csv). POST /api/admin/export/table builds the same files for the lists that filter client-side. Permission checks live in the same queries the screens use
 * (a denied query fails the request, never a partial file).
 */
import {
  exportFormat,
  exportResponse,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/admin/export-builder";
import { loadExpenseRows } from "@/lib/admin/expenses-data";
import { parseLedgerFilters, type SearchParams } from "@/lib/admin/finance-filters";
import { mapLedgerEntries } from "@/lib/admin/finance-view";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { isAppError } from "@/lib/errors";
import { listLedgerEntriesQuery } from "@/modules/finance/queries";
import { listPartnersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";
const MAX_PAGES = 50;
const money = (m: { amountMinor: number; currency: string }) => (m.amountMinor / 100).toFixed(2);

const fail = (status: number, message: string) =>
  new Response(message, { status, headers: { "content-type": "text/plain" } });

const EXPENSE_COLS: ExportColumn[] = [
  { header: "Date", type: "date" },
  { header: "Description", width: 36 },
  { header: "Category" },
  { header: "Product" },
  { header: "Amount", type: "num" },
  { header: "Currency", width: 10 },
  { header: "Amount INR", type: "money" },
  { header: "Shared", width: 10 },
  { header: "Recorded by" },
];
const LEDGER_COLS: ExportColumn[] = [
  { header: "Seq", type: "int", width: 10 },
  { header: "Date", type: "date" },
  { header: "Type" },
  { header: "Party" },
  { header: "Order" },
  { header: "Amount", type: "num" },
  { header: "Currency", width: 10 },
  { header: "FX rate", type: "num", width: 12 },
  { header: "Amount INR", type: "money" },
  { header: "Memo", width: 36 },
  { header: "Ref" },
  { header: "Created by" },
];

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const url = new URL(req.url);
  const format = exportFormat(url.searchParams.get("format"));
  url.searchParams.delete("format");
  const sp: SearchParams = Object.fromEntries(url.searchParams);
  let ctx;
  try {
    ctx = await getAdminRequestContext();
  } catch {
    return fail(401, "Sign in required");
  }

  try {
    if (kind === "expenses") {
      const { rows, ok } = await loadExpenseRows(sp, ctx);
      if (!ok) return fail(403, "Not allowed");
      return exportResponse(
        format,
        "expenses",
        EXPENSE_COLS,
        rows.map((r) => [
          r.at,
          r.description,
          r.category,
          r.product,
          money(r.amount),
          r.amount.currency,
          (r.amountInr / 100).toFixed(2),
          r.sharedBySplit ? "yes" : "no",
          r.recordedBy,
        ]),
      );
    }
    if (kind !== "ledger") return fail(404, "Unknown export");

    const filters = parseLedgerFilters(sp);
    let page = await listLedgerEntriesQuery({ filters, limit: 100 }, ctx);
    if (!page.ok) return fail(page.error.code === "FORBIDDEN" ? 403 : 400, page.error.message);
    const partners = await listPartnersQuery({ limit: 100 }, ctx).catch(() => null);
    const names = new Map(
      partners && partners.ok ? partners.data.items.map((p) => [p.id, p.displayName] as const) : [],
    );
    const out: unknown[][] = [];
    for (let i = 0; i < MAX_PAGES; i++) {
      if (!page.ok) return fail(400, page.error.message);
      for (const e of mapLedgerEntries(page.data.items, names)) {
        out.push([
          e.seq,
          e.at,
          e.type,
          e.party,
          e.order,
          money(e.amount),
          e.amount.currency,
          e.fxRate,
          (e.amountInr / 100).toFixed(2),
          e.memo,
          e.ref,
          e.createdBy,
        ]);
      }
      const next = page.data.nextCursor;
      if (!next) break;
      page = await listLedgerEntriesQuery({ filters, limit: 100, cursor: next }, ctx);
    }
    return exportResponse(format, "ledger", LEDGER_COLS, out);
  } catch (err) {
    return isAppError(err) ? fail(err.httpStatus, err.message) : fail(500, "Export failed");
  }
}

const MAX_ROWS = 20_000;
type TableBody = {
  format?: ExportFormat;
  filename?: string;
  columns?: ExportColumn[];
  rows?: unknown[][];
};

/** POST /api/admin/export/table: lists that filter client-side send their visible rows; the same builder renders them. */
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if ((await params).kind !== "table") return fail(404, "Unknown export");
  try {
    await getAdminRequestContext();
  } catch {
    return fail(401, "Sign in required");
  }
  const b = (await req.json().catch(() => null)) as TableBody | null;
  if (!b || !Array.isArray(b.columns) || !Array.isArray(b.rows) || b.rows.length > MAX_ROWS)
    return fail(400, "Bad export request");
  const columns = b.columns.map((c) => ({
    header: String(c.header),
    type: (["money", "num", "date", "int"] as const).find((t) => t === c.type),
  }));
  return exportResponse(
    exportFormat(b.format),
    String(b.filename ?? "export").slice(0, 60),
    columns,
    b.rows,
  );
}
