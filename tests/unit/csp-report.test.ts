// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { setAuditSink } from "../../src/lib/audit-port";
import { POST } from "../../src/app/api/csp-report/route";

const rows: unknown[] = [];
setAuditSink((e) => void rows.push(e));
const post = (body: string, ip = "1.1.1.1", stream = false) =>
  POST(
    new NextRequest("http://x/api/csp-report", {
      method: "POST",
      headers: { "x-forwarded-for": ip, "content-type": "application/reports+json" },
      body: stream
        ? new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(body));
              c.close();
            },
          })
        : body,
      ...(stream ? { duplex: "half" } : {}),
    } as ConstructorParameters<typeof NextRequest>[1]),
  );
const entry = (u: string) => ({
  type: "csp-violation",
  body: { effectiveDirective: "script-src-elem", blockedURL: u, documentURL: "http://x/" },
});

describe("csp-report ingest", () => {
  it("dedupes array-shaped report-to payloads by their own keys", async () => {
    rows.length = 0;
    await post(JSON.stringify([entry("a1"), entry("a2")]), "2.2.2.2");
    await post(JSON.stringify([entry("a1"), entry("a2")]), "2.2.2.2");
    await post(JSON.stringify([entry("a3")]), "2.2.2.2");
    expect(rows).toHaveLength(2);
  });
  it("caps bytes actually read, even with no content-length (streamed body)", async () => {
    rows.length = 0;
    const res = await post(JSON.stringify([entry("b".repeat(20_000))]), "3.3.3.3", true);
    expect(res.status).toBe(204);
    expect(rows).toHaveLength(0);
  });
  it("rate limits per IP so unique keys cannot flood the audit log", async () => {
    rows.length = 0;
    for (let i = 0; i < 60; i++) await post(JSON.stringify(entry(`u${i}`)), "4.4.4.4");
    expect(rows.length).toBeLessThanOrEqual(30);
    expect(rows.length).toBeGreaterThan(0);
  });
});
