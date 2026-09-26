import { describe, expect, it } from "vitest";
import { defaultManualDeps } from "@/modules/payments/providers/manual";

describe("QR generator unit tests", () => {
  it("renders a valid inline data URI for the UPI URI", async () => {
    const upiUri = "upi://pay?pa=codekraft@upi&pn=CodeKraft&am=100.00&cu=INR&tn=CK-ORD-000001";
    const qrDataUrl = await defaultManualDeps.renderQr(upiUri);

    expect(qrDataUrl.startsWith("data:image/svg+xml")).toBe(true);
    expect(qrDataUrl).toContain(encodeURIComponent(upiUri));
  });
});
