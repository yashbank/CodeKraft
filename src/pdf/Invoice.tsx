import React from "react";
import { toDecimalString } from "@/lib/money";
import type {
  BuyerSnapshot,
  GstBreakdown,
  InvoiceLine,
  SellerSnapshot,
} from "@/modules/invoices/types";

export interface InvoiceProps {
  invoiceNo: string;
  issuedAt: string;
  /** Order reference shown under the invoice number. */
  orderNo?: string | null;
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  lines: InvoiceLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  gstBreakdown?: GstBreakdown | null;
  /** Defaults to "paid" (invoices are issued on payment). */
  paymentStatus?: "paid" | "pending" | "refunded";
  /** Site accent (palette light variant, white text on it); slate when absent. */
  accent?: string;
  notes?: string | null;
}

export const PAYMENT_LABEL = {
  paid: "PAID",
  pending: "PAYMENT PENDING",
  refunded: "REFUNDED",
} as const;
export const DEFAULT_NOTE = "This is a computer-generated invoice and needs no signature.";

/** A4 print: hide site chrome, repeat the table head per page, never split a row, keep colours. */
const PRINT_CSS = `@page{size:A4;margin:14mm}
.ck-invoice{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ck-lines thead{display:table-header-group}
.ck-lines tr{break-inside:avoid;page-break-inside:avoid}
@media print{body *{visibility:hidden}.ck-invoice,.ck-invoice *{visibility:visible}
.ck-invoice{position:absolute;left:0;top:0;width:100%;padding:0!important}
header[role=banner],nav,footer{display:none!important}}`;

const DEFAULT_ACCENT = "#41507a";
const cell = { padding: "8px" } as const;
const right = { ...cell, textAlign: "right" } as const;

export function InvoiceDocument(props: InvoiceProps) {
  const formatMoney = toDecimalString;
  const g = props.gstBreakdown;
  const ratePct = g ? `${g.rate_bps / 100}%` : "";
  const accent = props.accent ?? DEFAULT_ACCENT;
  const { seller, buyer } = props;
  const total = (label: string, v: number, extra?: React.CSSProperties) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", ...extra }}>
      <span>{label}</span>
      <span>
        {props.currency} {formatMoney(v)}
      </span>
    </div>
  );
  const label: React.CSSProperties = {
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: "bold",
    color: accent,
    margin: "0 0 6px 0",
  };
  const p = { margin: "2px 0" } as const;

  return (
    <div
      className="ck-invoice"
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        padding: "40px",
        fontFamily: "sans-serif",
        fontSize: "14px",
      }}
    >
      <style>{PRINT_CSS}</style>
      <header
        style={{
          backgroundColor: accent,
          color: "#ffffff",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {seller.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- print sheet, snapshot URL
            <img
              src={seller.logo_url}
              alt={seller.name}
              style={{
                maxHeight: "56px",
                maxWidth: "160px",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                padding: "4px",
              }}
            />
          )}
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "bold", margin: 0 }}>TAX INVOICE</h1>
            <p style={{ margin: "2px 0" }}>{seller.name}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ ...p, fontWeight: "bold" }}>Invoice No: {props.invoiceNo}</p>
          {props.orderNo && <p style={p}>Order No: {props.orderNo}</p>}
          <p style={p}>Purchase Date: {props.issuedAt}</p>
        </div>
      </header>

      <p
        data-testid="payment-status"
        style={{
          display: "inline-block",
          backgroundColor: accent,
          color: "#ffffff",
          borderRadius: "999px",
          padding: "4px 14px",
          fontSize: "12px",
          fontWeight: "bold",
          margin: "0 0 20px 0",
        }}
      >
        {PAYMENT_LABEL[props.paymentStatus ?? "paid"]}
      </p>

      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
          marginBottom: "28px",
        }}
      >
        <div>
          <h3 style={label}>Sold By</h3>
          <p style={{ ...p, fontWeight: "bold" }}>{seller.name}</p>
          <p style={p}>{seller.address}</p>
          {seller.gst_number && <p style={p}>GSTIN: {seller.gst_number}</p>}
          {seller.pan && <p style={p}>PAN: {seller.pan}</p>}
          {seller.email && <p style={p}>Email: {seller.email}</p>}
          {seller.phone && <p style={p}>Phone: {seller.phone}</p>}
        </div>
        <div>
          <h3 style={label}>Billed To</h3>
          <p style={{ ...p, fontWeight: "bold" }}>{buyer.name}</p>
          {buyer.company && <p style={p}>{buyer.company}</p>}
          <p style={p}>{buyer.email}</p>
          {buyer.address && <p style={p}>{buyer.address}</p>}
          {buyer.gst_number && <p style={p}>GSTIN: {buyer.gst_number}</p>}
        </div>
      </section>

      <table
        className="ck-lines"
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px" }}
      >
        <thead>
          <tr style={{ backgroundColor: accent, color: "#ffffff", textAlign: "left" }}>
            <th style={cell}>#</th>
            <th style={cell}>Description</th>
            <th style={right}>Qty</th>
            <th style={right}>Unit Price</th>
            <th style={right}>Discount</th>
            <th style={right}>Tax{ratePct && ` (${ratePct})`}</th>
            <th style={right}>Total</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={cell}>{idx + 1}</td>
              <td style={cell}>
                {line.description}
                {line.hsn_sac && (
                  <small style={{ color: "#4b5563" }}> (HSN/SAC {line.hsn_sac})</small>
                )}
              </td>
              <td style={right}>{line.quantity}</td>
              <td style={right}>{formatMoney(line.unit_minor)}</td>
              <td style={right}>{formatMoney(line.discount_minor)}</td>
              <td style={right}>{formatMoney(line.tax_minor)}</td>
              <td style={right}>{formatMoney(line.total_minor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "300px" }}>
          {total("Subtotal:", props.subtotalMinor)}
          {props.discountMinor > 0 &&
            total("Discount:", -props.discountMinor, { color: "#166534" })}
          {g ? (
            <div data-testid="gst-block" style={{ fontSize: "13px" }}>
              {g.cgst_minor !== undefined && total("CGST:", g.cgst_minor)}
              {g.sgst_minor !== undefined && total("SGST:", g.sgst_minor)}
              {g.igst_minor !== undefined && total("IGST:", g.igst_minor)}
              {props.taxMinor > 0 && total("Total Tax:", props.taxMinor, { fontWeight: "bold" })}
            </div>
          ) : (
            props.taxMinor > 0 && total("Tax:", props.taxMinor)
          )}
          {total("Grand Total:", props.totalMinor, {
            backgroundColor: accent,
            color: "#ffffff",
            borderRadius: "8px",
            padding: "10px 12px",
            marginTop: "8px",
            fontWeight: "bold",
            fontSize: "16px",
          })}
        </div>
      </section>

      <section style={{ marginTop: "32px", fontSize: "12px", color: "#4b5563" }}>
        <h3 style={label}>Notes</h3>
        <p style={p}>{props.notes || DEFAULT_NOTE}</p>
      </section>
    </div>
  );
}

export default InvoiceDocument;
