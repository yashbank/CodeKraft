import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATES, renderEmailTemplate } from "@/emails";

const data = {
  kind: "x",
  summary: "Publish product abc",
  requesterName: "Ann",
  outcome: "applied",
};

describe("approval email templates", () => {
  it.each(["approval-needed", "approval-decided"])("%s renders the summary", async (name) => {
    const { html, text } = await renderEmailTemplate(name, data);
    expect(html).toContain("Publish product abc");
    expect(text).toContain("Publish product abc");
  });

  it("exposes template subjects for the outbox job", () => {
    expect(EMAIL_TEMPLATES["approval-needed"]!.subject(data)).toBe(
      "Approval needed: Publish product abc",
    );
    expect(EMAIL_TEMPLATES["payment-confirmed"]!.subject({ orderNo: "A1" })).toBe(
      "Payment confirmed for order A1",
    );
  });
});
