/**
 * GET /api/admin/export/{ledger|expenses}?<same query string as the screen>
 * Streams CSV for the current filters. Permission checks live in the same queries the screens use
 * (a denied query fails the request, never a partial file).
 */
import { csvLine } from "@/lib/admin/csv";
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

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const sp: SearchParams = Object.fromEntries(new URL(req.url).searchParams);
  let ctx;
  try {
    ctx = await getAdminRequestContext();
  } catch {
    return fail(401, "Sign in required");
  }
  const enc = new TextEncoder();
  const headers = {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
    "cache-control": "no-store",
  };

  try {
    if (kind === "expenses") {
      const { rows, ok } = await loadExpenseRows(sp, ctx);
      if (!ok) return fail(403, "Not allowed");
      const body =
        csvLine([
          "Date",
          "Description",
          "Category",
          "Product",
          "Amount",
          "Currency",
          "Amount INR",
          "Shared",
          "Recorded by",
        ]) +
        rows
          .map((r) =>
            csvLine([
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
          )
          .join("");
      return new Response(`\uFEFF${body}`, { headers });
    }
    if (kind !== "ledger") return fail(404, "Unknown export");

    const filters = parseLedgerFilters(sp);
    const first = await listLedgerEntriesQuery({ filters, limit: 100 }, ctx);
    if (!first.ok) return fail(first.error.code === "FORBIDDEN" ? 403 : 400, first.error.message);
    const partners = await listPartnersQuery({ limit: 100 }, ctx).catch(() => null);
    const names = new Map(
      partners && partners.ok ? partners.data.items.map((p) => [p.id, p.displayName] as const) : [],
    );
    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        c.enqueue(
          enc.encode(
            `\uFEFF${csvLine(["Seq", "Date", "Type", "Party", "Order", "Amount", "Currency", "FX rate", "Amount INR", "Memo", "Ref", "Created by"])}`,
          ),
        );
        let page: Awaited<ReturnType<typeof listLedgerEntriesQuery>> = first;
        for (let i = 0; i < MAX_PAGES; i++) {
          if (!page.ok) return c.error(new Error(page.error.message));
          for (const e of mapLedgerEntries(page.data.items, names)) {
            c.enqueue(
              enc.encode(
                csvLine([
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
                ]),
              ),
            );
          }
          const next = page.data.nextCursor;
          if (!next) break;
          page = await listLedgerEntriesQuery({ filters, limit: 100, cursor: next }, ctx);
        }
        c.close();
      },
    });
    return new Response(stream, { headers });
  } catch (err) {
    return isAppError(err) ? fail(err.httpStatus, err.message) : fail(500, "Export failed");
  }
}
