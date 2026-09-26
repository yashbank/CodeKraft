/**
 * Partner statement exports (PDF / CSV) (API-FIN-10, FR-FIN-11, D-513, docs/10 §13).
 */
import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { db } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { getDocumentsBucketName, getStorageDriver } from "@/lib/storage";
import { buildPdfBuffer } from "@/modules/invoices/pdf";
import { ledgerEntries } from "../../../drizzle/schema/finance";
import { partners } from "../../../drizzle/schema/users-ext";
import {
  exportStatementInput,
  type ExportStatementInput,
  type StatementExport,
} from "./types";

export async function exportStatement(
  ctx: RequestContext,
  rawInput: ExportStatementInput,
  database: DbOrTx = db,
): Promise<StatementExport> {
  assertPermission(ctx, "finance.statements.export");
  const input = exportStatementInput.parse(rawInput);

  // Role scoping: admin without read_all can only export own partner statement
  const canReadAll = can(ctx, "finance.ledger.read_all");
  if (!canReadAll) {
    const [callerPartner] = await database
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.userId, ctx.userId!))
      .limit(1);

    if (!callerPartner || callerPartner.id !== input.partnerId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Cannot export another partner's statement (API-FIN-10)");
    }
  }

  // Verify partner exists
  const [partner] = await database
    .select()
    .from(partners)
    .where(eq(partners.id, input.partnerId))
    .limit(1);

  if (!partner) {
    throw new AppError(ErrorCode.NOT_FOUND, `Partner ${input.partnerId} not found`);
  }

  const fromDate = new Date(`${input.dateFrom}T00:00:00.000Z`);
  const toDate = new Date(`${input.dateTo}T23:59:59.999Z`);

  // 1. Opening balance: sum of all partner entries before fromDate
  const [openingRes] = await database
    .select({
      sumMinor: sql<string>`COALESCE(SUM(amount_minor), 0)`,
      sumInrMinor: sql<string>`COALESCE(SUM(amount_inr_minor), 0)`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.partnerId, input.partnerId),
        lt(ledgerEntries.createdAt, fromDate),
      ),
    );

  const openingBalanceMinor = Number(openingRes?.sumMinor ?? 0);
  const openingBalanceInrMinor = Number(openingRes?.sumInrMinor ?? 0);

  // 2. Entries in period
  const entries = await database
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.partnerId, input.partnerId),
        gte(ledgerEntries.createdAt, fromDate),
        lte(ledgerEntries.createdAt, toDate),
      ),
    )
    .orderBy(asc(ledgerEntries.seq));

  const periodSumMinor = entries.reduce((acc, e) => acc + e.amountMinor, 0);
  const periodSumInrMinor = entries.reduce((acc, e) => acc + e.amountInrMinor, 0);

  // 3. Closing balance
  const closingBalanceMinor = openingBalanceMinor + periodSumMinor;
  const closingBalanceInrMinor = openingBalanceInrMinor + periodSumInrMinor;

  const storage = getStorageDriver();
  const bucket = getDocumentsBucketName();
  const timestamp = Date.now();
  const sanitizedName = partner.displayName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `statement-${sanitizedName}-${input.dateFrom}-${input.dateTo}.${input.format}`;
  const objectKey = `statements/${partner.id}/${timestamp}-${filename}`;

  if (input.format === "pdf") {
    // Generate PDF
    const textLines = [
      `Partner: ${partner.displayName} (${partner.id})`,
      `Period: ${input.dateFrom} to ${input.dateTo}`,
      `Opening Balance: INR ${(openingBalanceInrMinor / 100).toFixed(2)}`,
      `Closing Balance: INR ${(closingBalanceInrMinor / 100).toFixed(2)}`,
      `Total Entries in Period: ${entries.length}`,
      "----------------------------------------",
      ...entries.map(
        (e) =>
          `Seq #${e.seq} | ${e.createdAt.toISOString().slice(0, 10)} | ${e.entryType} | ${e.memo ?? ""} | ${e.currency} ${(e.amountMinor / 100).toFixed(2)}`,
      ),
    ];

    const pdfBuffer = buildPdfBuffer("PARTNER ACCOUNT STATEMENT", textLines);
    await storage.putObject(bucket, objectKey, pdfBuffer, "application/pdf");
  } else {
    // Generate CSV with OWASP formula-injection protection
    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return "";
      let s = String(val);
      if (/^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        s = `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines = [
      ["Partner Statement", partner.displayName],
      ["Period", `${input.dateFrom} to ${input.dateTo}`],
      ["Opening Balance (INR)", (openingBalanceInrMinor / 100).toFixed(2)],
      ["Closing Balance (INR)", (closingBalanceInrMinor / 100).toFixed(2)],
      [],
      ["Date", "Seq", "Type", "Party", "Description", "Amount", "Currency", "FX Rate", "Amount INR"],
      ...entries.map((e) => [
        escapeCsv(e.createdAt.toISOString().slice(0, 10)),
        escapeCsv(e.seq),
        escapeCsv(e.entryType),
        escapeCsv(e.partyType),
        escapeCsv(e.memo ?? ""),
        escapeCsv((e.amountMinor / 100).toFixed(2)),
        escapeCsv(e.currency),
        escapeCsv(e.fxRateToInr),
        escapeCsv((e.amountInrMinor / 100).toFixed(2)),
      ]),
    ];

    const csvContent = csvLines.map((row) => row.join(",")).join("\n");
    await storage.putObject(bucket, objectKey, Buffer.from(csvContent, "utf-8"), "text/csv");
  }

  const TTL_SECONDS = 300; // 5 minutes presigned URL
  const url = await storage.createPresignedGet(bucket, objectKey, TTL_SECONDS);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  // Audit log
  await auditService.log(
    ctx,
    "API-FIN-10 statement.exported",
    { type: "partner", id: partner.id },
    null,
    {
      partnerId: partner.id,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      format: input.format,
      openingBalanceInrMinor,
      closingBalanceInrMinor,
      entryCount: entries.length,
    },
    database,
  );

  return {
    url,
    filename,
    expiresAt,
  };
}
