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
}

/** A4 print: hide site chrome, repeat the table head per page, never split a row. */
const PRINT_CSS = `@page{size:A4;margin:14mm}
.ck-lines thead{display:table-header-group}
.ck-lines tr{break-inside:avoid;page-break-inside:avoid}
@media print{body *{visibility:hidden}.ck-invoice,.ck-invoice *{visibility:visible}
.ck-invoice{position:absolute;left:0;top:0;width:100%;padding:0!important}
header[role=banner],nav,footer{display:none!important}}`;

export function InvoiceDocument(props: InvoiceProps) {
  const formatMoney = toDecimalString;
  const g = props.gstBreakdown;
  const ratePct = g ? `${g.rate_bps / 100}%` : "";

  return (
    <div
      className="ck-invoice"
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        padding: "40px",
        fontFamily: "sans-serif",
      }}
    >
      <style>{PRINT_CSS}</style>
      <header
        style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "20px", marginBottom: "20px" }}
      >
        {props.seller.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- print sheet, snapshot URL
          <img src={props.seller.logo_url} alt={props.seller.name} style={{ maxHeight: "48px" }} />
        )}
        <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>TAX INVOICE</h1>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Invoice No: {props.invoiceNo}</p>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Date: {props.issuedAt}</p>
        {props.orderNo && (
          <p style={{ margin: "5px 0", color: "#6b7280" }}>Order: {props.orderNo}</p>
        )}
      </header>

      <section style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
        <div>
          <h3
            style={{ fontSize: "14px", fontWeight: "bold", color: "#374151", margin: "0 0 5px 0" }}
          >
            Sold By:
          </h3>
          <p style={{ margin: "2px 0", fontWeight: "bold" }}>{props.seller.name}</p>
          <p style={{ margin: "2px 0" }}>{props.seller.address}</p>
          {props.seller.gst_number && (
            <p style={{ margin: "2px 0" }}>GSTIN: {props.seller.gst_number}</p>
          )}
          {props.seller.pan && <p style={{ margin: "2px 0" }}>PAN: {props.seller.pan}</p>}
          {props.seller.email && <p style={{ margin: "2px 0" }}>Email: {props.seller.email}</p>}
          {props.seller.phone && <p style={{ margin: "2px 0" }}>Phone: {props.seller.phone}</p>}
        </div>

        <div>
          <h3
            style={{ fontSize: "14px", fontWeight: "bold", color: "#374151", margin: "0 0 5px 0" }}
          >
            Billed To:
          </h3>
          <p style={{ margin: "2px 0", fontWeight: "bold" }}>{props.buyer.name}</p>
          {props.buyer.company && <p style={{ margin: "2px 0" }}>{props.buyer.company}</p>}
          <p style={{ margin: "2px 0" }}>{props.buyer.email}</p>
          {props.buyer.address && <p style={{ margin: "2px 0" }}>{props.buyer.address}</p>}
          {props.buyer.gst_number && (
            <p style={{ margin: "2px 0" }}>GSTIN: {props.buyer.gst_number}</p>
          )}
        </div>
      </section>

      <table
        className="ck-lines"
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "8px" }}>#</th>
            <th style={{ padding: "8px" }}>Description</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Qty</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Unit Price</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Discount</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Tax{ratePct && ` (${ratePct})`}</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px" }}>{idx + 1}</td>
              <td style={{ padding: "8px" }}>
                {line.description}
                {line.hsn_sac && (
                  <small style={{ color: "#6b7280" }}> (HSN/SAC {line.hsn_sac})</small>
                )}
              </td>
              <td style={{ padding: "8px", textAlign: "right" }}>{line.quantity}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(line.unit_minor)}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>
                {formatMoney(line.discount_minor)}
              </td>
              <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(line.tax_minor)}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>
                {formatMoney(line.total_minor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "280px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>Subtotal:</span>
            <span>
              {props.currency} {formatMoney(props.subtotalMinor)}
            </span>
          </div>
          {props.discountMinor > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                color: "#16a34a",
              }}
            >
              <span>Discount:</span>
              <span>
                -{props.currency} {formatMoney(props.discountMinor)}
              </span>
            </div>
          )}

          {props.gstBreakdown ? (
            <div
              data-testid="gst-block"
              style={{ borderTop: "1px dashed #e5e7eb", padding: "6px 0", margin: "6px 0" }}
            >
              {props.gstBreakdown.cgst_minor !== undefined && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    fontSize: "13px",
                  }}
                >
                  <span>CGST:</span>
                  <span>
                    {props.currency} {formatMoney(props.gstBreakdown.cgst_minor)}
                  </span>
                </div>
              )}
              {props.gstBreakdown.sgst_minor !== undefined && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    fontSize: "13px",
                  }}
                >
                  <span>SGST:</span>
                  <span>
                    {props.currency} {formatMoney(props.gstBreakdown.sgst_minor)}
                  </span>
                </div>
              )}
              {props.gstBreakdown.igst_minor !== undefined && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    fontSize: "13px",
                  }}
                >
                  <span>IGST:</span>
                  <span>
                    {props.currency} {formatMoney(props.gstBreakdown.igst_minor)}
                  </span>
                </div>
              )}
            </div>
          ) : props.taxMinor > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>Tax:</span>
              <span>
                {props.currency} {formatMoney(props.taxMinor)}
              </span>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderTop: "2px solid #111827",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            <span>Total:</span>
            <span>
              {props.currency} {formatMoney(props.totalMinor)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default InvoiceDocument;
