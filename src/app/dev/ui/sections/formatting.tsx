import { fyFor, isoDate } from "@/lib/dates";
import { format, type Currency } from "@/lib/money";
import { Row, Section } from "./_section";

const SAMPLES: Array<{ amountMinor: number; currency: Currency }> = [
  { amountMinor: 12345678, currency: "INR" },
  { amountMinor: 9900, currency: "USD" },
  { amountMinor: 8999, currency: "EUR" },
  { amountMinor: 7900, currency: "GBP" },
  { amountMinor: 12900, currency: "CAD" },
];

export function FormattingSection() {
  const now = new Date("2027-03-31T18:29:59Z");
  return (
    <Section
      id="formatting"
      title="Money & dates"
      description="lib/money.format (minor units, lakh grouping for INR) and lib/dates.fyFor (Asia/Kolkata FY)."
    >
      <Row label="money">
        {SAMPLES.map((m) => (
          <code
            key={m.currency}
            className="rounded-sm bg-elevated px-2 py-1 font-mono text-body-sm"
          >
            {m.amountMinor} {m.currency} → {format(m)}
          </code>
        ))}
      </Row>
      <Row label="financial year">
        <code className="font-mono text-body-sm">
          {isoDate(now, "UTC")}T18:29:59Z → FY {fyFor(now)}
        </code>
        <code className="font-mono text-body-sm">
          …T18:30:00Z → FY {fyFor(new Date("2027-03-31T18:30:00Z"))}
        </code>
      </Row>
    </Section>
  );
}
