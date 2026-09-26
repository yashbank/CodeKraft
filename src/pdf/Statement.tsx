import React from "react";

export interface StatementLine {
  date: string;
  type: string;
  description: string;
  amountMinor: number;
}

export interface StatementProps {
  partnerName: string;
  dateFrom: string;
  dateTo: string;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  currency: string;
  lines: StatementLine[];
}

export function StatementDocument(props: StatementProps) {
  const formatMoney = (minor: number) => (minor / 100).toFixed(2);

  return (
    <div style={{ backgroundColor: "#ffffff", color: "#111827", padding: "40px", fontFamily: "sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "20px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>PARTNER STATEMENT</h1>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Partner: {props.partnerName}</p>
        <p style={{ margin: "5px 0", color: "#6b7280" }}>Period: {props.dateFrom} to {props.dateTo}</p>
      </header>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <span>Opening Balance: {props.currency} {formatMoney(props.openingBalanceMinor)}</span>
        <span>Closing Balance: {props.currency} {formatMoney(props.closingBalanceMinor)}</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "8px" }}>Date</th>
            <th style={{ padding: "8px" }}>Type</th>
            <th style={{ padding: "8px" }}>Description</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px" }}>{line.date}</td>
              <td style={{ padding: "8px" }}>{line.type}</td>
              <td style={{ padding: "8px" }}>{line.description}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(line.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StatementDocument;
