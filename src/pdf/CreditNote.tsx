import React from "react";
import type { BuyerSnapshot, SellerSnapshot } from "@/modules/invoices/types";

export interface CreditNoteProps {
  creditNo: string;
  invoiceNo: string;
  issuedAt: string;
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  amountMinor: number;
  currency: string;
}

export function CreditNoteDocument(props: CreditNoteProps) {
  const formatMoney = (minor: number) => (minor / 100).toFixed(2);

  return (
    <div style={{ backgroundColor: "#ffffff", color: "#111827", padding: "40px", fontFamily: "sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "20px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>CREDIT NOTE</h1>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Credit Note No: {props.creditNo}</p>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Against Invoice No: {props.invoiceNo}</p>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Date: {props.issuedAt}</p>
      </header>

      <section style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#374151", margin: "0 0 5px 0" }}>Issued By:</h3>
          <p style={{ margin: "2px 0", fontWeight: "bold" }}>{props.seller.name}</p>
          <p style={{ margin: "2px 0" }}>{props.seller.address}</p>
          {props.seller.gst_number && <p style={{ margin: "2px 0" }}>GSTIN: {props.seller.gst_number}</p>}
        </div>

        <div>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#374151", margin: "0 0 5px 0" }}>Issued To:</h3>
          <p style={{ margin: "2px 0", fontWeight: "bold" }}>{props.buyer.name}</p>
          <p style={{ margin: "2px 0" }}>{props.buyer.email}</p>
        </div>
      </section>

      <div style={{ borderTop: "2px solid #111827", borderBottom: "2px solid #111827", padding: "16px 0", margin: "30px 0", display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold" }}>
        <span>Credit Amount:</span>
        <span>{props.currency} {formatMoney(props.amountMinor)}</span>
      </div>
    </div>
  );
}

export default CreditNoteDocument;
