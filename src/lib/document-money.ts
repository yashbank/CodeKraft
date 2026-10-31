/**
 * Money formatting for documents (invoice / credit note HTML, PDF, print, exports, emails).
 * Pure + client-safe. Stored amounts are the legal amounts: converted values are only ever an
 * explicitly labelled "≈" note, never a replacement.
 */
import { convertWithTable, type RateTable } from "./currency-convert";
import {
  CURRENCY_LOCALE,
  FRACTION_DIGITS,
  format,
  isCurrency,
  toDecimalString,
  type Currency,
} from "./money";

/** `12345678` + INR -> `1,23,456.78` (en-IN lakh grouping); no symbol. Unknown currency -> en-US. */
export function groupedAmount(amountMinor: number, currency: string): string {
  const locale = isCurrency(currency) ? CURRENCY_LOCALE[currency] : "en-US";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: FRACTION_DIGITS,
    maximumFractionDigits: FRACTION_DIGITS,
  }).format(toDecimalString(amountMinor) as `${number}`);
}

/** HTML/print/email: symbol + grouping, e.g. `₹1,23,456.78`, `$1,234.50`. Unknown currency -> `XXX 1,234.50`. */
export function documentMoney(amountMinor: number, currency: string): string {
  return isCurrency(currency)
    ? format({ amountMinor, currency })
    : `${currency} ${groupedAmount(amountMinor, currency)}`;
}

/** PDF (built-in fonts have no ₹/€ glyphs): ISO code + grouping, e.g. `INR 1,23,456.78`. */
export function pdfMoney(amountMinor: number, currency: string): string {
  return `${currency} ${groupedAmount(amountMinor, currency)}`;
}

export interface ApproxNote {
  amountMinor: number;
  currency: Currency;
  /** Rate date (YYYY-MM-DD). */
  rateDate: string;
}

/** `null` when the viewer currency equals the stored one or either currency is not convertible. */
export function approxNote(
  amountMinor: number,
  stored: string,
  viewer: Currency,
  table: RateTable,
): ApproxNote | null {
  if (!isCurrency(stored) || stored === viewer) return null;
  try {
    return {
      amountMinor: convertWithTable(amountMinor, stored, viewer, table),
      currency: viewer,
      rateDate: table.fetchedAt.slice(0, 10),
    };
  } catch {
    return null;
  }
}

/** HTML: `≈ $12.34 (indicative, rate of 2026-11-01)`. PDF (`pdf: true`): ASCII-only `approx. USD 12.34 ...`. */
export function approxText(n: ApproxNote, pdf = false): string {
  const tail = `(indicative only, rate of ${n.rateDate}; amounts above are the legal amounts)`;
  return pdf
    ? `approx. ${pdfMoney(n.amountMinor, n.currency)} ${tail}`
    : `≈ ${documentMoney(n.amountMinor, n.currency)} ${tail}`;
}
